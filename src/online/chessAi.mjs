import { applyChessMove, legalChessMoves, validChessState } from './chessRules.mjs'

const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const PIECE_VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20_000 }
const CENTER_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 2, 3, 3, 2, 1, 0],
  [0, 1, 3, 4, 4, 3, 1, 0],
  [0, 1, 3, 4, 4, 3, 1, 0],
  [0, 1, 2, 3, 3, 2, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]

const opposite = color => color === 'white' ? 'black' : 'white'
const winnerColor = winner => winner === 'host' ? 'white' : winner === 'guest' ? 'black' : null
const samePosition = (a, b) => a[0] === b[0] && a[1] === b[1]

/** Retorna todas as jogadas que chessRules considera legais para o turno atual. */
export function getAllLegalChessMoves(state) {
  if (!validChessState(state) || state.phase !== 'playing') return []
  const moves = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (state.board[row][col]?.color !== state.turn) continue
      for (const to of legalChessMoves(state, [row, col])) {
        moves.push({ from: [row, col], to: [...to], promotion: 'queen' })
      }
    }
  }
  return moves
}

function capturedValue(state, move) {
  const moving = state.board[move.from[0]][move.from[1]]
  let captured = state.board[move.to[0]][move.to[1]]
  // En passant: o destino está vazio, mas o peão adversário fica ao lado da origem.
  if (!captured && moving?.type === 'pawn' && move.from[1] !== move.to[1]) {
    captured = state.board[move.from[0]][move.to[1]]
  }
  return captured ? PIECE_VALUES[captured.type] ?? 0 : 0
}

function movedPieceCanBeCaptured(nextState, move) {
  if (nextState.phase !== 'playing') return false
  return getAllLegalChessMoves(nextState).some(reply => samePosition(reply.to, move.to))
}

function tacticalScore(state, move) {
  const moving = state.board[move.from[0]][move.from[1]]
  const capture = capturedValue(state, move)
  const next = applyChessMove(state, move.from, move.to, move.promotion)
  if (next === state) return -Infinity
  if (next.phase === 'finished') {
    if (next.winner === 'draw') return 20_000
    return winnerColor(next.winner) === state.turn ? 1_000_000 : -1_000_000
  }

  let score = capture * 12
  if (next.checked === next.turn) score += 180
  if (moving?.type === 'pawn' && (move.to[0] === 0 || move.to[0] === 7)) score += 8_000
  score += CENTER_BONUS[move.to[0]][move.to[1]] * 8

  if (movedPieceCanBeCaptured(next, move)) {
    score -= (PIECE_VALUES[moving?.type] ?? 0) * 10
  }
  return score
}

function materialAndPosition(state, perspective) {
  if (state.phase === 'finished') {
    if (state.winner === 'draw') return 0
    return winnerColor(state.winner) === perspective ? 1_000_000 : -1_000_000
  }

  let score = 0
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const current = state.board[row][col]
      if (!current) continue
      const direction = current.color === perspective ? 1 : -1
      const center = CENTER_BONUS[row][col]
      const advancement = current.type === 'pawn'
        ? (current.color === 'white' ? 6 - row : row - 1) * 4
        : 0
      score += direction * ((PIECE_VALUES[current.type] ?? 0) + center * 3 + advancement)
    }
  }
  if (state.checked === perspective) score -= 45
  if (state.checked === opposite(perspective)) score += 45
  return score
}

function orderedMoves(state) {
  return getAllLegalChessMoves(state)
    .map(move => ({ move, score: tacticalScore(state, move) }))
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.move)
}

function alphaBeta(state, depth, alpha, beta, perspective, budget) {
  budget.nodes += 1
  if (depth <= 0 || state.phase === 'finished' || budget.nodes >= budget.maxNodes || Date.now() >= budget.deadline) {
    return materialAndPosition(state, perspective)
  }

  const moves = orderedMoves(state)
  if (moves.length === 0) return materialAndPosition(state, perspective)
  const maximizing = state.turn === perspective

  if (maximizing) {
    let value = -Infinity
    for (const move of moves) {
      const next = applyChessMove(state, move.from, move.to, move.promotion)
      value = Math.max(value, alphaBeta(next, depth - 1, alpha, beta, perspective, budget))
      alpha = Math.max(alpha, value)
      if (alpha >= beta || budget.nodes >= budget.maxNodes || Date.now() >= budget.deadline) break
    }
    return value
  }

  let value = Infinity
  for (const move of moves) {
    const next = applyChessMove(state, move.from, move.to, move.promotion)
    value = Math.min(value, alphaBeta(next, depth - 1, alpha, beta, perspective, budget))
    beta = Math.min(beta, value)
    if (alpha >= beta || budget.nodes >= budget.maxNodes || Date.now() >= budget.deadline) break
  }
  return value
}

function pickRandom(items, random) {
  const raw = Number(random())
  const normalized = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.999999999) : 0
  return items[Math.floor(normalized * items.length)]
}

/**
 * Escolhe uma jogada sem alterar o estado recebido.
 * `options.random` permite testes determinísticos; a busca difícil é limitada por nós.
 */
export function chooseChessMove(state, difficulty = 'medium', options = {}) {
  const moves = getAllLegalChessMoves(state)
  if (moves.length === 0) return null

  const level = DIFFICULTIES.has(difficulty) ? difficulty : 'medium'
  const random = typeof options.random === 'function' ? options.random : Math.random
  if (level === 'easy') return pickRandom(moves, random)

  const ranked = moves
    .map(move => ({ move, score: tacticalScore(state, move) }))
    .sort((a, b) => b.score - a.score)

  if (level === 'medium') {
    const bestScore = ranked[0].score
    const candidates = ranked.filter(entry => entry.score === bestScore).map(entry => entry.move)
    return pickRandom(candidates, random)
  }

  const perspective = state.turn
  const requestedDepth = Number.isInteger(options.depth) ? options.depth : 3
  const depth = Math.min(Math.max(requestedDepth, 1), 4)
  const requestedNodes = Number.isInteger(options.maxNodes) ? options.maxNodes : 2_000
  const requestedTime = Number.isFinite(options.maxTimeMs) ? options.maxTimeMs : 320
  const budget = {
    nodes: 0,
    maxNodes: Math.min(Math.max(requestedNodes, 100), 30_000),
    deadline: Date.now() + Math.min(Math.max(requestedTime, 50), 800),
  }
  let bestScore = -Infinity
  let bestMoves = []

  for (const { move } of ranked) {
    const next = applyChessMove(state, move.from, move.to, move.promotion)
    const score = alphaBeta(next, depth - 1, -Infinity, Infinity, perspective, budget)
    if (score > bestScore) {
      bestScore = score
      bestMoves = [move]
    } else if (score === bestScore) {
      bestMoves.push(move)
    }
    if (bestScore >= 1_000_000 || budget.nodes >= budget.maxNodes || Date.now() >= budget.deadline) break
  }

  return pickRandom(bestMoves.length ? bestMoves : [ranked[0].move], random)
}
