import test from 'node:test'
import assert from 'node:assert/strict'
import { applyChessMove, createChessState, legalChessMoves } from '../src/online/chessRules.mjs'
import { chooseChessMove, getAllLegalChessMoves } from '../src/online/chessAi.mjs'

const play = (state, from, to) => applyChessMove(state, from, to)
const isLegal = (state, move) => Boolean(move)
  && legalChessMoves(state, move.from).some(to => to[0] === move.to[0] && to[1] === move.to[1])

function sparseState(turn = 'black') {
  const state = createChessState()
  state.board = Array.from({ length: 8 }, () => Array(8).fill(null))
  state.board[7][4] = { type: 'king', color: 'white' }
  state.board[0][4] = { type: 'king', color: 'black' }
  state.turn = turn
  state.castling = { whiteKing: false, whiteQueen: false, blackKing: false, blackQueen: false }
  return state
}

test('gerador da IA enumera somente as 20 jogadas legais da abertura', () => {
  const state = createChessState()
  const moves = getAllLegalChessMoves(state)
  assert.equal(moves.length, 20)
  assert.ok(moves.every(move => isLegal(state, move)))
})

test('nível fácil escolhe aleatoriamente sem sair das jogadas legais', () => {
  let state = createChessState()
  state = play(state, [6, 4], [4, 4])
  const first = chooseChessMove(state, 'easy', { random: () => 0 })
  const last = chooseChessMove(state, 'easy', { random: () => 0.999999 })
  assert.ok(isLegal(state, first))
  assert.ok(isLegal(state, last))
  assert.notDeepEqual(first, last)
})

test('nível médio prioriza uma captura valiosa e segura', () => {
  const state = sparseState('black')
  state.board[3][0] = { type: 'rook', color: 'black' }
  state.board[3][6] = { type: 'queen', color: 'white' }
  const move = chooseChessMove(state, 'medium', { random: () => 0 })
  assert.ok(isLegal(state, move))
  assert.deepEqual(move.from, [3, 0])
  assert.deepEqual(move.to, [3, 6])
})

test('nível difícil encontra o xeque-mate imediato das pretas', () => {
  let state = createChessState()
  state = play(state, [6, 5], [5, 5])
  state = play(state, [1, 4], [3, 4])
  state = play(state, [6, 6], [4, 6])
  const move = chooseChessMove(state, 'hard', { random: () => 0, maxNodes: 4_000 })
  assert.ok(isLegal(state, move))
  assert.deepEqual(move.from, [0, 3])
  assert.deepEqual(move.to, [4, 7])
  const result = play(state, move.from, move.to)
  assert.equal(result.phase, 'finished')
  assert.equal(result.winner, 'guest')
})

test('os três níveis sempre devolvem jogada aplicável e não alteram o estado recebido', () => {
  let state = createChessState()
  state = play(state, [6, 3], [4, 3])
  const snapshot = JSON.stringify(state)
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const move = chooseChessMove(state, difficulty, { random: () => 0.25, depth: 2, maxNodes: 1_000 })
    assert.ok(isLegal(state, move), `${difficulty} deve escolher jogada legal`)
    assert.notStrictEqual(applyChessMove(state, move.from, move.to), state)
  }
  assert.equal(JSON.stringify(state), snapshot, 'a IA não deve modificar o estado original')
})

test('IA não inventa movimento quando a partida terminou', () => {
  const state = sparseState('black')
  state.phase = 'finished'
  state.winner = 'draw'
  assert.deepEqual(getAllLegalChessMoves(state), [])
  assert.equal(chooseChessMove(state, 'hard'), null)
})

test('busca difícil respeita orçamento curto e ainda entrega uma jogada legal', () => {
  let state = createChessState()
  state = play(state, [6, 4], [4, 4])
  const startedAt = performance.now()
  const move = chooseChessMove(state, 'hard', { maxTimeMs: 80, maxNodes: 30_000 })
  const elapsed = performance.now() - startedAt
  assert.ok(isLegal(state, move))
  assert.ok(elapsed < 500, `busca levou ${elapsed.toFixed(1)}ms`)
})
