const PIECES = new Set(['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'])
const COLORS = new Set(['white', 'black'])

const piece = (type, color) => ({ type, color })
const inside = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8
const opponent = color => color === 'white' ? 'black' : 'white'

export function createChessState() {
  const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
  const board = Array.from({ length: 8 }, () => Array(8).fill(null))
  board[0] = back.map(type => piece(type, 'black'))
  board[1] = Array.from({ length: 8 }, () => piece('pawn', 'black'))
  board[6] = Array.from({ length: 8 }, () => piece('pawn', 'white'))
  board[7] = back.map(type => piece(type, 'white'))
  return {
    board,
    turn: 'white',
    phase: 'playing',
    winner: null,
    checked: null,
    lastMove: null,
    castling: { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true },
    moveNumber: 1,
  }
}

export function validChessState(state) {
  return Boolean(state && Array.isArray(state.board) && state.board.length === 8
    && state.board.every(row => Array.isArray(row) && row.length === 8 && row.every(cell => cell === null
      || (cell && PIECES.has(cell.type) && COLORS.has(cell.color))))
    && COLORS.has(state.turn) && ['playing', 'finished'].includes(state.phase))
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => cell ? { ...cell } : null))
}

function squareAttacked(board, row, col, byColor) {
  const pawnRow = row + (byColor === 'white' ? 1 : -1)
  for (const dc of [-1, 1]) if (inside(pawnRow, col + dc)) {
    const p = board[pawnRow][col + dc]
    if (p?.color === byColor && p.type === 'pawn') return true
  }
  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const r = row + dr; const c = col + dc
    if (inside(r, c) && board[r][c]?.color === byColor && board[r][c]?.type === 'knight') return true
  }
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue
    const r = row + dr; const c = col + dc
    if (inside(r, c) && board[r][c]?.color === byColor && board[r][c]?.type === 'king') return true
  }
  const rays = [
    [-1, 0, new Set(['rook', 'queen'])], [1, 0, new Set(['rook', 'queen'])],
    [0, -1, new Set(['rook', 'queen'])], [0, 1, new Set(['rook', 'queen'])],
    [-1, -1, new Set(['bishop', 'queen'])], [-1, 1, new Set(['bishop', 'queen'])],
    [1, -1, new Set(['bishop', 'queen'])], [1, 1, new Set(['bishop', 'queen'])],
  ]
  for (const [dr, dc, types] of rays) {
    let r = row + dr; let c = col + dc
    while (inside(r, c)) {
      const target = board[r][c]
      if (target) {
        if (target.color === byColor && types.has(target.type)) return true
        break
      }
      r += dr; c += dc
    }
  }
  return false
}

export function kingInCheck(state, color) {
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const current = state.board[row][col]
    if (current?.type === 'king' && current.color === color) return squareAttacked(state.board, row, col, opponent(color))
  }
  return true
}

function addRayMoves(board, moves, row, col, color, directions) {
  for (const [dr, dc] of directions) {
    let r = row + dr; let c = col + dc
    while (inside(r, c)) {
      const target = board[r][c]
      if (!target) moves.push([r, c])
      else {
        if (target.color !== color) moves.push([r, c])
        break
      }
      r += dr; c += dc
    }
  }
}

function pseudoMoves(state, row, col) {
  const current = state.board[row]?.[col]
  if (!current) return []
  const { board } = state
  const moves = []
  const add = (r, c) => { if (inside(r, c) && board[r][c]?.color !== current.color) moves.push([r, c]) }
  if (current.type === 'pawn') {
    const direction = current.color === 'white' ? -1 : 1
    const start = current.color === 'white' ? 6 : 1
    if (inside(row + direction, col) && !board[row + direction][col]) {
      moves.push([row + direction, col])
      if (row === start && !board[row + direction * 2][col]) moves.push([row + direction * 2, col])
    }
    for (const dc of [-1, 1]) {
      const r = row + direction; const c = col + dc
      if (inside(r, c) && board[r][c] && board[r][c].color !== current.color) moves.push([r, c])
      const last = state.lastMove
      if (inside(r, c) && !board[r][c] && last?.piece === 'pawn' && last.color !== current.color
        && Math.abs(last.from[0] - last.to[0]) === 2 && last.to[0] === row && last.to[1] === c) moves.push([r, c])
    }
  } else if (current.type === 'knight') {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) add(row + dr, col + dc)
  } else if (current.type === 'bishop') {
    addRayMoves(board, moves, row, col, current.color, [[-1, -1], [-1, 1], [1, -1], [1, 1]])
  } else if (current.type === 'rook') {
    addRayMoves(board, moves, row, col, current.color, [[-1, 0], [1, 0], [0, -1], [0, 1]])
  } else if (current.type === 'queen') {
    addRayMoves(board, moves, row, col, current.color, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]])
  } else if (current.type === 'king') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(row + dr, col + dc)
    const home = current.color === 'white' ? 7 : 0
    const rights = current.color === 'white'
      ? { king: state.castling?.whiteKing, queen: state.castling?.whiteQueen }
      : { king: state.castling?.blackKing, queen: state.castling?.blackQueen }
    if (row === home && col === 4 && !squareAttacked(board, home, 4, opponent(current.color))) {
      if (rights.king && board[home][7]?.type === 'rook' && board[home][7]?.color === current.color
        && !board[home][5] && !board[home][6]
        && !squareAttacked(board, home, 5, opponent(current.color)) && !squareAttacked(board, home, 6, opponent(current.color))) moves.push([home, 6])
      if (rights.queen && board[home][0]?.type === 'rook' && board[home][0]?.color === current.color
        && !board[home][1] && !board[home][2] && !board[home][3]
        && !squareAttacked(board, home, 3, opponent(current.color)) && !squareAttacked(board, home, 2, opponent(current.color))) moves.push([home, 2])
    }
  }
  return moves
}

function moveOnBoard(state, from, to, promotion = 'queen') {
  const board = cloneBoard(state.board)
  const current = board[from[0]][from[1]]
  const captured = board[to[0]][to[1]]
  if (!current) return null
  if (current.type === 'pawn' && from[1] !== to[1] && !captured) board[from[0]][to[1]] = null
  board[to[0]][to[1]] = current
  board[from[0]][from[1]] = null
  if (current.type === 'king' && Math.abs(from[1] - to[1]) === 2) {
    const rookFrom = to[1] === 6 ? 7 : 0
    const rookTo = to[1] === 6 ? 5 : 3
    board[to[0]][rookTo] = board[to[0]][rookFrom]
    board[to[0]][rookFrom] = null
  }
  if (current.type === 'pawn' && (to[0] === 0 || to[0] === 7)) current.type = ['queen', 'rook', 'bishop', 'knight'].includes(promotion) ? promotion : 'queen'
  return { board, current, captured }
}

export function legalChessMoves(state, from) {
  if (!validChessState(state) || !Array.isArray(from) || from.length !== 2) return []
  const [row, col] = from
  if (!inside(row, col) || state.board[row][col]?.color !== state.turn || state.phase !== 'playing') return []
  return pseudoMoves(state, row, col).filter(to => {
    const moved = moveOnBoard(state, from, to)
    return moved && !kingInCheck({ ...state, board: moved.board }, state.turn)
  })
}

function insufficientMaterial(board) {
  const nonKings = board.flat().filter(value => value && value.type !== 'king')
  if (nonKings.length === 0) return true
  if (nonKings.length === 1 && ['bishop', 'knight'].includes(nonKings[0].type)) return true
  return false
}

export function applyChessMove(state, from, to, promotion = 'queen') {
  if (!validChessState(state) || !Array.isArray(to)) return state
  if (!legalChessMoves(state, from).some(move => move[0] === to[0] && move[1] === to[1])) return state
  const moved = moveOnBoard(state, from, to, promotion)
  if (!moved) return state
  const currentColor = state.turn
  const nextTurn = opponent(currentColor)
  const castling = { ...state.castling }
  const movingBeforePromotion = state.board[from[0]][from[1]]
  if (movingBeforePromotion.type === 'king') {
    castling[`${currentColor}King`] = false
    castling[`${currentColor}Queen`] = false
  }
  const revokeRook = (color, row, col) => {
    const home = color === 'white' ? 7 : 0
    if (row === home && col === 0) castling[`${color}Queen`] = false
    if (row === home && col === 7) castling[`${color}King`] = false
  }
  if (movingBeforePromotion.type === 'rook') revokeRook(currentColor, from[0], from[1])
  if (moved.captured?.type === 'rook') revokeRook(moved.captured.color, to[0], to[1])
  let next = {
    ...state,
    board: moved.board,
    turn: nextTurn,
    castling,
    lastMove: { from: [...from], to: [...to], piece: movingBeforePromotion.type, color: currentColor },
    checked: null,
    moveNumber: state.moveNumber + (currentColor === 'black' ? 1 : 0),
  }
  const checked = kingInCheck(next, nextTurn) ? nextTurn : null
  next = { ...next, checked }
  const hasMove = next.board.some((row, r) => row.some((cell, c) => cell?.color === nextTurn && legalChessMoves(next, [r, c]).length > 0))
  if (!hasMove) {
    next.phase = 'finished'
    next.winner = checked ? (currentColor === 'white' ? 'host' : 'guest') : 'draw'
  } else if (insufficientMaterial(next.board)) {
    next.phase = 'finished'
    next.winner = 'draw'
  }
  return next
}
