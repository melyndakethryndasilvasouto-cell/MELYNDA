import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type Player = 1 | 2
type PieceType = 'normal' | 'king'

interface Piece {
  player: Player
  type: PieceType
}

type Cell = Piece | null
type Board = Cell[][]

type GameMode = 'two' | 'easy' | 'medium'
type GamePhase = 'menu' | 'playing' | 'won'

interface MoveStep {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  captured?: { row: number; col: number }
}

interface ValidMove {
  steps: MoveStep[]
  isCapture: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BOARD_SIZE = 8
const DARK_SQ = '#1E3A5F'
const LIGHT_SQ = '#EEF6FF'
const P1_COLOR = '#6BB8FF'
const P2_COLOR = '#A78BFA'
const P1_DARK = '#4A90D9'
const P2_DARK = '#7B5EA7'

// ─── Board helpers ────────────────────────────────────────────────────────────
function isDark(row: number, col: number) {
  return (row + col) % 2 === 1
}

function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (isDark(r, c)) board[r][c] = { player: 2, type: 'normal' }
    }
  }
  for (let r = 5; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (isDark(r, c)) board[r][c] = { player: 1, type: 'normal' }
    }
  }
  return board
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
}

// ─── Move generation ──────────────────────────────────────────────────────────
function getJumpsFrom(
  board: Board,
  r: number,
  c: number,
  piece: Piece,
  visited: Set<string>
): MoveStep[][] {
  const dirs: number[][] =
    piece.type === 'king'
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.player === 1
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]]

  const chains: MoveStep[][] = []

  for (const [dr, dc] of dirs) {
    const mr = r + dr
    const mc = c + dc
    const lr = r + 2 * dr
    const lc = c + 2 * dc
    if (!inBounds(mr, mc) || !inBounds(lr, lc)) continue
    const midCell = board[mr][mc]
    if (!midCell || midCell.player === piece.player) continue
    const key = `${mr},${mc}`
    if (visited.has(key)) continue
    if (board[lr][lc] !== null) continue

    const step: MoveStep = {
      fromRow: r, fromCol: c,
      toRow: lr, toCol: lc,
      captured: { row: mr, col: mc },
    }

    const nb = cloneBoard(board)
    nb[lr][lc] = nb[r][c]
    nb[r][c] = null
    nb[mr][mc] = null

    const promotedType: PieceType =
      piece.type === 'king' ||
      (piece.player === 1 && lr === 0) ||
      (piece.player === 2 && lr === BOARD_SIZE - 1)
        ? 'king'
        : 'normal'
    nb[lr][lc] = { player: piece.player, type: promotedType }

    const newVisited = new Set(visited)
    newVisited.add(key)

    const further = getJumpsFrom(nb, lr, lc, nb[lr][lc]!, newVisited)
    if (further.length === 0) {
      chains.push([step])
    } else {
      for (const chain of further) {
        chains.push([step, ...chain])
      }
    }
  }

  return chains
}

function getValidMoves(board: Board, player: Player): ValidMove[] {
  const captures: ValidMove[] = []
  const normals: ValidMove[] = []

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c]
      if (!cell || cell.player !== player) continue

      const chains = getJumpsFrom(board, r, c, cell, new Set())
      for (const chain of chains) {
        captures.push({ steps: chain, isCapture: true })
      }

      if (captures.length === 0) {
        const dirs: number[][] =
          cell.type === 'king'
            ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
            : player === 1
            ? [[-1, -1], [-1, 1]]
            : [[1, -1], [1, 1]]
        for (const [dr, dc] of dirs) {
          const nr = r + dr
          const nc = c + dc
          if (inBounds(nr, nc) && board[nr][nc] === null) {
            normals.push({
              steps: [{ fromRow: r, fromCol: c, toRow: nr, toCol: nc }],
              isCapture: false,
            })
          }
        }
      }
    }
  }

  return captures.length > 0 ? captures : normals
}

function applyMove(board: Board, move: ValidMove): Board {
  const nb = cloneBoard(board)
  for (const step of move.steps) {
    const piece = nb[step.fromRow][step.fromCol]!
    nb[step.toRow][step.toCol] = piece
    nb[step.fromRow][step.fromCol] = null
    if (step.captured) {
      nb[step.captured.row][step.captured.col] = null
    }
  }
  const lastStep = move.steps[move.steps.length - 1]
  const piece = nb[lastStep.toRow][lastStep.toCol]!
  if (
    (piece.player === 1 && lastStep.toRow === 0) ||
    (piece.player === 2 && lastStep.toRow === BOARD_SIZE - 1)
  ) {
    nb[lastStep.toRow][lastStep.toCol] = { ...piece, type: 'king' }
  }
  return nb
}

// ─── AI logic ─────────────────────────────────────────────────────────────────
function scoreBoard(b: Board): number {
  let s = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = b[r][c]
      if (!cell) continue
      const posBonus = cell.player === 2 ? r : BOARD_SIZE - 1 - r
      const val = cell.type === 'king' ? 5 : 3
      const pb = posBonus * 0.1
      if (cell.player === 2) s += val + pb
      else s -= val + pb
    }
  }
  return s
}

function aiPickMove(board: Board, difficulty: 'easy' | 'medium'): ValidMove | null {
  const moves = getValidMoves(board, 2)
  if (moves.length === 0) return null
  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)]
  }
  let best: ValidMove = moves[0]
  let bestScore = -Infinity
  for (const m of moves) {
    const nb = applyMove(board, m)
    let sc = scoreBoard(nb)
    if (m.isCapture) sc += m.steps.length * 2
    sc += Math.random() * 0.3
    if (sc > bestScore) { bestScore = sc; best = m }
  }
  return best
}

// ─── Piece counts ─────────────────────────────────────────────────────────────
function countPieces(board: Board) {
  let p1 = 0; let p2 = 0
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]?.player === 1) p1++
      else if (board[r][c]?.player === 2) p2++
    }
  return { p1, p2 }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CheckersGame() {
  const { playSound } = useSound()
  const { updateScore } = usePlayer()

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [mode, setMode] = useState<GameMode>('two')
  const [board, setBoard] = useState<Board>(createInitialBoard)
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1)
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null)
  const [validMoves, setValidMoves] = useState<ValidMove[]>([])
  const [allMoves, setAllMoves] = useState<ValidMove[]>([])
  const [winner, setWinner] = useState<Player | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [capturedP1, setCapturedP1] = useState(0)
  const [capturedP2, setCapturedP2] = useState(0)
  const [lastCapture, setLastCapture] = useState(false)
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fireConfetti = useCallback(() => {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#6BB8FF','#A78BFA','#ffffff','#FCD34D'] })
    setTimeout(() => confetti({ particleCount: 80, spread: 90, origin: { y: 0.4 }, colors: ['#6BB8FF','#A78BFA','#FCD34D'] }), 400)
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    const moves = getValidMoves(board, currentPlayer)
    setAllMoves(moves)
    setSelected(null)
    setValidMoves([])
    if (moves.length === 0) {
      const w: Player = currentPlayer === 1 ? 2 : 1
      setWinner(w)
      setPhase('won')
      playSound('win')
      fireConfetti()
      if (w === 1) updateScore('checkers', countPieces(board).p1 * 10)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, currentPlayer, phase])

  useEffect(() => {
    if (phase !== 'playing') return
    if (mode === 'two') return
    if (currentPlayer !== 2) return
    aiTimeoutRef.current = setTimeout(() => {
      const diff = mode === 'easy' ? 'easy' : 'medium'
      const move = aiPickMove(board, diff)
      if (!move) return
      executeMove(board, move, 2)
    }, 600)
    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, phase, mode])

  const executeMove = useCallback((b: Board, move: ValidMove, player: Player) => {
    const nb = applyMove(b, move)
    setBoard(nb)
    if (move.isCapture) {
      playSound('match')
      const cnt = move.steps.filter(s => s.captured).length
      if (player === 1) setCapturedP1(prev => prev + cnt)
      else setCapturedP2(prev => prev + cnt)
      setLastCapture(true)
    } else {
      playSound('click')
      setLastCapture(false)
    }
    setCurrentPlayer(player === 1 ? 2 : 1)
  }, [playSound])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (phase !== 'playing') return
    if (mode !== 'two' && currentPlayer === 2) return
    const cell = board[row][col]
    if (cell && cell.player === currentPlayer) {
      playSound('click')
      setSelected({ row, col })
      setValidMoves(allMoves.filter(m => m.steps[0].fromRow === row && m.steps[0].fromCol === col))
      return
    }
    if (selected) {
      const targetMove = validMoves.find(m => {
        const last = m.steps[m.steps.length - 1]
        return last.toRow === row && last.toCol === col
      })
      if (targetMove) {
        executeMove(board, targetMove, currentPlayer)
        setSelected(null)
        setValidMoves([])
        return
      }
    }
    setSelected(null)
    setValidMoves([])
  }, [phase, mode, currentPlayer, board, selected, validMoves, allMoves, executeMove, playSound])

  const restart = useCallback(() => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    setBoard(createInitialBoard())
    setCurrentPlayer(1)
    setSelected(null)
    setValidMoves([])
    setAllMoves([])
    setWinner(null)
    setCapturedP1(0)
    setCapturedP2(0)
    setLastCapture(false)
    setPhase('playing')
  }, [])

  const goMenu = useCallback(() => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    setPhase('menu')
  }, [])

  const validDestSet = new Set(validMoves.map(m => {
    const last = m.steps[m.steps.length - 1]
    return `${last.toRow},${last.toCol}`
  }))
  const selectablePieceSet = new Set(allMoves.map(m => `${m.steps[0].fromRow},${m.steps[0].fromCol}`))
  const { p1: liveP1, p2: liveP2 } = countPieces(board)

  // ── MENU ──────────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 w-full max-w-sm text-center">
          <div style={{ fontSize: 64 }}>♟️</div>
          <h1 style={{ fontFamily: "'Fredoka One'", color: '#1E3A5F', fontSize: 32, margin: '8px 0 4px' }}>Dama</h1>
          <p style={{ color: '#7B5EA7', fontFamily: 'Nunito', fontSize: 14, marginBottom: 28 }}>Jogo de Dama Brasileiro</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {([
              { id: 'two' as GameMode, label: '👥 Dois Jogadores', desc: 'Jogue com um amigo' },
              { id: 'easy' as GameMode, label: '🤖 Vs IA (Fácil)', desc: 'IA joga aleatoriamente' },
              { id: 'medium' as GameMode, label: '🤖 Vs IA (Médio)', desc: 'IA usa estratégia básica' },
            ]).map(opt => (
              <button key={opt.id} onClick={() => { playSound('click'); setMode(opt.id) }}
                className={opt.id === mode ? 'btn-primary' : 'btn-secondary'}
                style={{ minHeight: 56, fontFamily: 'Nunito', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span>{opt.label}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{opt.desc}</span>
              </button>
            ))}
          </div>
          <button className="btn-primary w-full" style={{ minHeight: 52, fontFamily: "'Fredoka One'", fontSize: 20 }}
            onClick={() => { playSound('click'); restart() }}>▶ Jogar</button>
          <button className="btn-secondary w-full" style={{ minHeight: 44, fontFamily: 'Nunito', marginTop: 12 }}
            onClick={() => { playSound('click'); setShowHelp(true) }}>❓ Ajuda</button>
        </motion.div>
        <HelpModal show={showHelp} onClose={() => setShowHelp(false)} />
      </div>
    )
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-3 gap-3" style={{ fontFamily: 'Nunito' }}>
      <div className="glass-card w-full max-w-2xl px-4 py-3 flex items-center justify-between">
        <button className="btn-secondary" style={{ minHeight: 40, fontSize: 13, padding: '6px 14px' }}
          onClick={() => { playSound('click'); goMenu() }}>← Menu</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Fredoka One'", color: '#1E3A5F', fontSize: 20 }}>Dama</div>
          <div style={{ fontSize: 12, color: '#7B5EA7' }}>
            {mode === 'two' ? '👥 2 Jogadores' : mode === 'easy' ? '🤖 IA Fácil' : '🤖 IA Médio'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ minHeight: 40, fontSize: 13, padding: '6px 14px' }}
            onClick={() => { playSound('click'); setShowHelp(true) }}>❓</button>
          <button className="btn-secondary" style={{ minHeight: 40, fontSize: 13, padding: '6px 14px' }}
            onClick={() => { playSound('click'); restart() }}>🔄</button>
        </div>
      </div>

      <TurnIndicator player={currentPlayer} mode={mode} lastCapture={lastCapture} />

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', justifyContent: 'center', width: '100%', maxWidth: 720 }}>
        <ScorePanel player={2} pieces={liveP2} captured={capturedP2} mode={mode} isActive={currentPlayer === 2} />

        <div className="glass-card p-3 game-area" style={{ flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`, gap: 0, border: '3px solid #1E3A5F', borderRadius: 8, overflow: 'hidden' }}>
            {Array.from({ length: BOARD_SIZE }, (_, row) =>
              Array.from({ length: BOARD_SIZE }, (_, col) => {
                const dark = isDark(row, col)
                const piece = board[row][col]
                const isSelected = selected?.row === row && selected?.col === col
                const isValidDest = validDestSet.has(`${row},${col}`)
                const isSelectable = !selected && dark && selectablePieceSet.has(`${row},${col}`) && piece?.player === currentPlayer
                return (
                  <BoardCell key={`${row}-${col}`} row={row} col={col} dark={dark} piece={piece}
                    isSelected={isSelected} isValidDest={isValidDest} isSelectable={isSelectable}
                    onClick={() => handleCellClick(row, col)} />
                )
              })
            )}
          </div>
        </div>

        <ScorePanel player={1} pieces={liveP1} captured={capturedP1} mode={mode} isActive={currentPlayer === 1} />
      </div>

      <AnimatePresence>
        {phase === 'won' && winner !== null && (
          <WinModal winner={winner} mode={mode} onRestart={restart} onMenu={goMenu} />
        )}
      </AnimatePresence>
      <HelpModal show={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}

// ─── BoardCell ────────────────────────────────────────────────────────────────
interface BoardCellProps {
  row: number; col: number; dark: boolean; piece: Cell; isSelected: boolean; isValidDest: boolean; isSelectable: boolean; onClick: () => void
}

function BoardCell({ row, col, dark, piece, isSelected, isValidDest, isSelectable, onClick }: BoardCellProps) {
  const sz = 'clamp(36px, 5.5vw, 56px)'
  return (
    <button type="button" onClick={onClick} data-cell={`${row}-${col}`} data-player={piece?.player ?? ''}
      aria-label={`Casa ${row + 1}, ${col + 1}${piece ? `, peça do jogador ${piece.player}` : ''}`}
      style={{ width: sz, height: sz, background: dark ? DARK_SQ : LIGHT_SQ, position: 'relative', padding: 0, border: 0,
      cursor: dark && (piece || isValidDest || isSelectable) ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
      {isValidDest && !piece && (
        <div style={{ width: '36%', height: '36%', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', border: '2px solid rgba(255,255,255,0.7)', pointerEvents: 'none' }} />
      )}
      {isValidDest && piece && (
        <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(255,220,0,0.85)', pointerEvents: 'none', zIndex: 5 }} />
      )}
      {piece && (
        <motion.div layout initial={{ scale: 0.7 }} animate={{ scale: 1 }}
          style={{ width: '76%', height: '76%', borderRadius: '50%',
            background: piece.player === 1
              ? `radial-gradient(circle at 35% 35%, #AADDFF, ${P1_COLOR} 55%, ${P1_DARK})`
              : `radial-gradient(circle at 35% 35%, #D9B8FF, ${P2_COLOR} 55%, ${P2_DARK})`,
            border: isSelected ? '3px solid #FCD34D' : `2px solid ${piece.player === 1 ? P1_DARK : P2_DARK}`,
            boxShadow: isSelected ? '0 0 14px 5px rgba(252,211,77,0.85)' : '0 2px 6px rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: 3, transition: 'border 0.15s, box-shadow 0.15s' }}>
          {piece.type === 'king' && <span style={{ fontSize: 'clamp(10px, 1.8vw, 18px)', lineHeight: 1, userSelect: 'none' }}>♕</span>}
        </motion.div>
      )}
      {isSelectable && !isSelected && (
        <motion.div animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }}
          style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: '2px solid rgba(252,211,77,0.75)', pointerEvents: 'none', zIndex: 4 }} />
      )}
    </button>
  )
}

// ─── ScorePanel ───────────────────────────────────────────────────────────────
function ScorePanel({ player, pieces, captured, mode, isActive }: { player: Player; pieces: number; captured: number; mode: GameMode; isActive: boolean }) {
  const color = player === 1 ? P1_COLOR : P2_COLOR
  const dark = player === 1 ? P1_DARK : P2_DARK
  const label = player === 1 ? 'Jogador 1' : mode === 'two' ? 'Jogador 2' : 'IA'
  const emoji = player === 1 ? '🔵' : '🟣'
  return (
    <motion.div animate={{ scale: isActive ? 1.04 : 1, opacity: isActive ? 1 : 0.72 }} transition={{ duration: 0.2 }}
      className="glass-card p-4 text-center"
      style={{ flexShrink: 0, minWidth: 110, border: isActive ? `2px solid ${color}` : '2px solid transparent' }}>
      <div style={{ fontSize: 28 }}>{emoji}</div>
      <div style={{ fontFamily: "'Fredoka One'", color: dark, fontSize: 15, marginTop: 2 }}>{label}</div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: '#888' }}>Peças</div>
        <div style={{ fontSize: 30, fontFamily: "'Fredoka One'", color: dark }}>{pieces}</div>
      </div>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 11, color: '#888' }}>Capturas</div>
        <div style={{ fontSize: 22, fontFamily: "'Fredoka One'", color }}>×{captured}</div>
      </div>
    </motion.div>
  )
}

// ─── TurnIndicator ────────────────────────────────────────────────────────────
function TurnIndicator({ player, mode, lastCapture }: { player: Player; mode: GameMode; lastCapture: boolean }) {
  const color = player === 1 ? P1_COLOR : P2_COLOR
  const label = player === 1 ? 'Jogador 1' : mode === 'two' ? 'Jogador 2' : 'IA'
  const isAiTurn = player === 2 && mode !== 'two'
  return (
    <motion.div key={player} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card w-full max-w-2xl"
      style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
        style={{ width: 16, height: 16, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
      <span style={{ fontFamily: "'Fredoka One'", color, fontSize: 18 }}>
        {isAiTurn ? '🤖 IA pensando...' : `${lastCapture ? '💥 ' : ''}Vez de ${label}`}
      </span>
    </motion.div>
  )
}

// ─── WinModal ─────────────────────────────────────────────────────────────────
function WinModal({ winner, mode, onRestart, onMenu }: { winner: Player; mode: GameMode; onRestart: () => void; onMenu: () => void }) {
  const color = winner === 1 ? P1_DARK : P2_DARK
  const label = winner === 1 ? 'Jogador 1 venceu!' : mode === 'two' ? 'Jogador 2 venceu!' : 'A IA venceu!'
  const emoji = winner === 1 || mode === 'two' ? '🏆' : '🤖'
  const sub = winner === 1 ? 'Parabéns pela vitória!' : mode === 'two' ? 'Incrível jogada!' : 'Tente de novo!'
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.45 }} className="glass-card p-8 text-center w-full max-w-xs">
        <div style={{ fontSize: 64 }}>{emoji}</div>
        <h2 style={{ fontFamily: "'Fredoka One'", fontSize: 26, color, margin: '8px 0 4px' }}>{label}</h2>
        <p style={{ color: '#555', fontFamily: 'Nunito', marginBottom: 24 }}>{sub}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-primary" style={{ minHeight: 52, fontFamily: "'Fredoka One'", fontSize: 18 }} onClick={onRestart}>🔄 Jogar Novamente</button>
          <button className="btn-secondary" style={{ minHeight: 44, fontFamily: 'Nunito' }} onClick={onMenu}>← Menu Principal</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── HelpModal ────────────────────────────────────────────────────────────────
function HelpModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}
          onClick={onClose}>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            className="glass-card p-6 w-full max-w-sm" style={{ maxHeight: '85vh', overflowY: 'auto' }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Fredoka One'", color: '#1E3A5F', fontSize: 22, marginBottom: 12 }}>❓ Como Jogar Dama</h2>
            <div style={{ fontFamily: 'Nunito', color: '#333', fontSize: 14, lineHeight: 1.7 }}>
              <p><strong>🎯 Objetivo:</strong> Capturar todas as peças do adversário ou deixá-lo sem movimentos válidos.</p>
              <br />
              <p><strong>♟️ Movimentos:</strong></p>
              <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
                <li>Peças normais movem diagonalmente <em>apenas para frente</em>.</li>
                <li>Damas (♕) movem diagonalmente em <strong>qualquer direção</strong>.</li>
              </ul>
              <br />
              <p><strong>💥 Capturas:</strong></p>
              <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
                <li>Salte sobre uma peça inimiga adjacente para capturá-la.</li>
                <li><strong>Captura é obrigatória</strong> — se puder capturar, deve capturar.</li>
                <li>Se puder continuar capturando, <strong>deve fazê-lo</strong> (captura múltipla).</li>
              </ul>
              <br />
              <p><strong>♕ Coroação:</strong> Peça que chega à última fileira adversária vira <strong>Dama</strong> (coroa ♕) e pode se mover em qualquer direção diagonal.</p>
              <br />
              <p><strong style={{ color: P1_DARK }}>🔵 Jogador 1</strong> (azul) — parte de baixo.<br /><strong style={{ color: P2_DARK }}>🟣 Jogador 2 / IA</strong> (roxo) — parte de cima.</p>
              <br />
              <p><strong>📱 Como jogar:</strong> Toque/clique em uma peça para selecioná-la. Círculos brancos = destinos válidos. Toque no destino para mover.</p>
            </div>
            <button className="btn-primary w-full" style={{ minHeight: 48, fontFamily: "'Fredoka One'", fontSize: 17, marginTop: 20 }} onClick={onClose}>✅ Entendi!</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
