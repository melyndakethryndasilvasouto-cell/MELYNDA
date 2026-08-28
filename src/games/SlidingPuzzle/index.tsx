import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

// Types
type GridSize = 3 | 4
type GamePhase = 'menu' | 'playing' | 'solved'

interface BestScore {
  moves: number
  time: number
}

interface BestScores {
  '3': BestScore | null
  '4': BestScore | null
}

// ── Puzzle Logic ──────────────────────────────────────────────────────────────

function countInversions(tiles: number[]): number {
  const arr = tiles.filter(t => t !== 0)
  let inv = 0
  for (let i = 0; i < arr.length - 1; i++)
    for (let j = i + 1; j < arr.length; j++)
      if (arr[i] > arr[j]) inv++
  return inv
}

function isSolvable(tiles: number[], size: GridSize): boolean {
  const inv = countInversions(tiles)
  if (size % 2 === 1) {
    return inv % 2 === 0
  } else {
    const emptyIdx = tiles.indexOf(0)
    const emptyRow = Math.floor(emptyIdx / size)
    const rowFromBottom = size - emptyRow
    return (inv + rowFromBottom) % 2 === 1
  }
}

function solvedTiles(size: GridSize): number[] {
  const n = size * size
  const t: number[] = []
  for (let i = 1; i < n; i++) t.push(i)
  t.push(0)
  return t
}

function shufflePuzzle(size: GridSize): number[] {
  const tiles = solvedTiles(size)
  const moveCount = size === 3 ? 200 : 400
  let emptyIdx = tiles.length - 1
  for (let m = 0; m < moveCount; m++) {
    const row = Math.floor(emptyIdx / size)
    const col = emptyIdx % size
    const neighbors: number[] = []
    if (row > 0) neighbors.push(emptyIdx - size)
    if (row < size - 1) neighbors.push(emptyIdx + size)
    if (col > 0) neighbors.push(emptyIdx - 1)
    if (col < size - 1) neighbors.push(emptyIdx + 1)
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)]
    tiles[emptyIdx] = tiles[pick]
    tiles[pick] = 0
    emptyIdx = pick
  }
  if (!isSolvable(tiles, size)) {
    const idxA = tiles.findIndex(t => t !== 0)
    const idxB = tiles.findIndex((t, i) => t !== 0 && i > idxA)
    ;[tiles[idxA], tiles[idxB]] = [tiles[idxB], tiles[idxA]]
  }
  return tiles
}

function isSolved(tiles: number[], size: GridSize): boolean {
  const goal = solvedTiles(size)
  return tiles.every((t, i) => t === goal[i])
}

function manhattanDist(value: number, currentIdx: number, size: GridSize): number {
  if (value === 0) return 0
  const goalIdx = value - 1
  const curRow = Math.floor(currentIdx / size)
  const curCol = currentIdx % size
  const goalRow = Math.floor(goalIdx / size)
  const goalCol = goalIdx % size
  return Math.abs(curRow - goalRow) + Math.abs(curCol - goalCol)
}

function findHintTile(tiles: number[], size: GridSize): number {
  const emptyIdx = tiles.indexOf(0)
  const emptyRow = Math.floor(emptyIdx / size)
  const emptyCol = emptyIdx % size
  const candidates: number[] = []
  if (emptyRow > 0) candidates.push(emptyIdx - size)
  if (emptyRow < size - 1) candidates.push(emptyIdx + size)
  if (emptyCol > 0) candidates.push(emptyIdx - 1)
  if (emptyCol < size - 1) candidates.push(emptyIdx + 1)
  let bestIdx = candidates[0]
  let bestDist = -1
  for (const cIdx of candidates) {
    const d = manhattanDist(tiles[cIdx], cIdx, size)
    if (d > bestDist) { bestDist = d; bestIdx = cIdx }
  }
  return bestIdx
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function loadBestScores(): BestScores {
  try {
    const raw = localStorage.getItem('mel-sliding-best')
    if (raw) return JSON.parse(raw)
  } catch { /* */ }
  return { '3': null, '4': null }
}

function saveBestScores(scores: BestScores) {
  localStorage.setItem('mel-sliding-best', JSON.stringify(scores))
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SlidingPuzzle() {
  const { playSound } = useSound()
  const { updateScore } = usePlayer()

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [size, setSize] = useState<GridSize>(3)
  const [tiles, setTiles] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [hintIdx, setHintIdx] = useState<number | null>(null)
  const [solvedCells, setSolvedCells] = useState(false)
  const [bestScores, setBestScores] = useState<BestScores>(loadBestScores)
  const [showHelp, setShowHelp] = useState(false)
  const [newRecord, setNewRecord] = useState(false)

  const dragOriginRef = useRef<{ x: number; y: number; tileIdx: number } | null>(null)
  const tilesRef = useRef<number[]>([])
  tilesRef.current = tiles
  const sizeRef = useRef<GridSize>(size)
  sizeRef.current = size
  const movesRef = useRef(0)
  movesRef.current = moves
  const elapsedRef = useRef(0)
  elapsedRef.current = elapsed

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const delayedTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const defer = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      delayedTimersRef.current = delayedTimersRef.current.filter(item => item !== timer)
      callback()
    }, delay)
    delayedTimersRef.current.push(timer)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }, [stopTimer])

  useEffect(() => () => {
    stopTimer()
    delayedTimersRef.current.forEach(timer => clearTimeout(timer))
    delayedTimersRef.current = []
  }, [stopTimer])

  const checkWin = useCallback((newTiles: number[], newMoves: number, time: number, currentSize: GridSize) => {
    if (!isSolved(newTiles, currentSize)) return
    stopTimer()
    setSolvedCells(true)
    defer(() => {
      playSound('win')
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.55 }, colors: ['#6BB8FF','#A78BFA','#ffffff','#FCD34D','#86EFAC'] })
      defer(() => confetti({ particleCount: 80, spread: 60, origin: { y: 0.4, x: 0.3 }, colors: ['#6BB8FF','#A78BFA','#FCD34D'] }), 400)
      setBestScores(prev => {
        const key = String(currentSize) as '3' | '4'
        const current = prev[key]
        const isNew = !current || newMoves < current.moves || (newMoves === current.moves && time < current.time)
        if (isNew) {
          setNewRecord(true)
          const next = { ...prev, [key]: { moves: newMoves, time } }
          saveBestScores(next)
          updateScore('SlidingPuzzle', Math.max(0, 1000 - newMoves))
          return next
        }
        return prev
      })
      setPhase('solved')
    }, 600)
  }, [defer, stopTimer, playSound, updateScore])

  const moveTileAt = useCallback((tileIdx: number) => {
    const current = tilesRef.current
    const currentSize = sizeRef.current
    const emptyIdx = current.indexOf(0)
    const emptyRow = Math.floor(emptyIdx / currentSize)
    const emptyCol = emptyIdx % currentSize
    const tileRow = Math.floor(tileIdx / currentSize)
    const tileCol = tileIdx % currentSize
    const isAdjacent =
      (tileRow === emptyRow && Math.abs(tileCol - emptyCol) === 1) ||
      (tileCol === emptyCol && Math.abs(tileRow - emptyRow) === 1)
    if (!isAdjacent) return
    playSound('click')
    const newTiles = [...current]
    newTiles[emptyIdx] = newTiles[tileIdx]
    newTiles[tileIdx] = 0
    const newMoves = movesRef.current + 1
    setTiles(newTiles)
    setMoves(newMoves)
    setHintIdx(null)
    checkWin(newTiles, newMoves, elapsedRef.current, currentSize)
  }, [playSound, checkWin])

  const startGame = useCallback((gridSize: GridSize) => {
    playSound('click')
    stopTimer()
    setSize(gridSize)
    sizeRef.current = gridSize
    setTiles(shufflePuzzle(gridSize))
    setMoves(0)
    setElapsed(0)
    setHintIdx(null)
    setSolvedCells(false)
    setNewRecord(false)
    setPhase('playing')
    defer(startTimer, 80)
  }, [defer, playSound, stopTimer, startTimer])

  const reshuffleGame = useCallback(() => {
    playSound('click')
    stopTimer()
    const currentSize = sizeRef.current
    setTiles(shufflePuzzle(currentSize))
    setMoves(0)
    setElapsed(0)
    setHintIdx(null)
    setSolvedCells(false)
    setNewRecord(false)
    defer(startTimer, 80)
  }, [defer, playSound, stopTimer, startTimer])

  const showHint = useCallback(() => {
    playSound('click')
    const idx = findHintTile(tilesRef.current, sizeRef.current)
    setHintIdx(idx)
    defer(() => setHintIdx(null), 3000)
  }, [defer, playSound])

  const handlePointerDown = useCallback((e: React.PointerEvent, tileIdx: number) => {
    dragOriginRef.current = { x: e.clientX, y: e.clientY, tileIdx }
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent, tileIdx: number) => {
    if (!dragOriginRef.current || dragOriginRef.current.tileIdx !== tileIdx) return
    const { x: ox, y: oy } = dragOriginRef.current
    dragOriginRef.current = null
    const dx = e.clientX - ox
    const dy = e.clientY - oy
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const threshold = 12

    if (absDx < threshold && absDy < threshold) {
      moveTileAt(tileIdx)
      return
    }

    const current = tilesRef.current
    const currentSize = sizeRef.current
    const emptyIdx = current.indexOf(0)
    const emptyRow = Math.floor(emptyIdx / currentSize)
    const emptyCol = emptyIdx % currentSize
    const tileRow = Math.floor(tileIdx / currentSize)
    const tileCol = tileIdx % currentSize

    if (absDx > absDy) {
      const dir = dx > 0 ? 1 : -1
      if (tileRow === emptyRow && emptyCol - tileCol === dir) moveTileAt(tileIdx)
    } else {
      const dir = dy > 0 ? 1 : -1
      if (tileCol === emptyCol && emptyRow - tileRow === dir) moveTileAt(tileIdx)
    }
  }, [moveTileAt])

  useEffect(() => {
    if (phase !== 'playing') return
    const handler = (e: KeyboardEvent) => {
      const currentSize = sizeRef.current
      const emptyIdx = tilesRef.current.indexOf(0)
      const emptyRow = Math.floor(emptyIdx / currentSize)
      const emptyCol = emptyIdx % currentSize
      let target = -1
      if (e.key === 'ArrowUp'    && emptyRow < currentSize - 1) target = emptyIdx + currentSize
      if (e.key === 'ArrowDown'  && emptyRow > 0)               target = emptyIdx - currentSize
      if (e.key === 'ArrowLeft'  && emptyCol < currentSize - 1) target = emptyIdx + 1
      if (e.key === 'ArrowRight' && emptyCol > 0)               target = emptyIdx - 1
      if (target >= 0) { e.preventDefault(); moveTileAt(target) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, moveTileAt])

  const emptyIdx = tiles.indexOf(0)
  const bestKey = String(size) as '3' | '4'
  const best = bestScores[bestKey]

  const boardPx = 356
  const gap = 6
  const tilePx = Math.floor((boardPx - gap * (size + 1)) / size)

  // ── Menu ──────────────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center">
          <div className="text-6xl mb-2">🧩</div>
          <h1 className="text-4xl font-bold mb-1" style={{ fontFamily: "'Fredoka One', cursive", color: '#6BB8FF' }}>
            Quebra-Cabeça
          </h1>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Fredoka One', cursive", color: '#A78BFA' }}>
            Deslizante
          </h2>
        </motion.div>

        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
          className="glass-card p-6 w-full max-w-sm flex flex-col gap-4">
          <p className="text-center font-bold text-lg" style={{ color: '#7B5EA7' }}>Escolha a dificuldade:</p>

          <ModeCard label="3×3" subtitle="Fácil — 8 peças" emoji="🟦" onClick={() => startGame(3)} best={bestScores['3']} />
          <ModeCard label="4×4" subtitle="Difícil — 15 peças" emoji="🟪" onClick={() => startGame(4)} best={bestScores['4']} />

          <button className="btn-secondary mt-2" style={{ minHeight: 44 }}
            onClick={() => { playSound('click'); setShowHelp(true) }}>
            ❓ Como Jogar
          </button>
        </motion.div>

        <AnimatePresence>
          {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
        </AnimatePresence>
      </div>
    )
  }

  // ── Playing / Solved ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-4 pb-8 px-3 gap-4 game-area">

      {/* Header */}
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="glass-card px-4 py-3 w-full max-w-sm flex items-center justify-between">
        <button className="btn-secondary px-3 py-2 text-sm" style={{ minHeight: 44 }}
          onClick={() => { playSound('click'); stopTimer(); setPhase('menu') }}>
          ← Menu
        </button>
        <div className="flex gap-4 text-center">
          <div>
            <div className="text-xs font-bold" style={{ color: '#A78BFA' }}>MOVIMENTOS</div>
            <div className="text-xl font-black" style={{ color: '#7B5EA7' }}>{moves}</div>
          </div>
          <div>
            <div className="text-xs font-bold" style={{ color: '#6BB8FF' }}>TEMPO</div>
            <div className="text-xl font-black" style={{ color: '#4A90D9' }}>{formatTime(elapsed)}</div>
          </div>
        </div>
        <button className="btn-secondary px-3 py-2 text-sm" style={{ minHeight: 44 }}
          onClick={() => { playSound('click'); setShowHelp(true) }}>
          ❓
        </button>
      </motion.div>

      {best && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-xs font-bold text-center" style={{ color: '#A78BFA' }}>
          🏆 Melhor: {best.moves} mov · {formatTime(best.time)}
        </motion.div>
      )}

      <div className="text-sm font-bold" style={{ color: '#7B5EA7' }}>Grade {size}×{size}</div>

      {/* Board */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="glass-card"
        style={{
          padding: gap,
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, ${tilePx}px)`,
          gridTemplateRows: `repeat(${size}, ${tilePx}px)`,
          gap: gap,
          width: Math.min(boardPx, window.innerWidth - 24),
          maxWidth: '100%',
        }}
      >
        {tiles.map((value, idx) => {
          const row = Math.floor(idx / size)
          const col = idx % size
          const eRow = Math.floor(emptyIdx / size)
          const eCol = emptyIdx % size
          const isMovable = value !== 0 && phase === 'playing' && (
            (row === eRow && Math.abs(col - eCol) === 1) ||
            (col === eCol && Math.abs(row - eRow) === 1)
          )
          return (
            <Tile
              key={value === 0 ? 'empty' : `tile-${value}`}
              value={value}
              sizePx={tilePx}
              isHint={idx === hintIdx}
              isMovable={isMovable}
              isSolved={solvedCells && value !== 0}
              onPointerDown={phase === 'playing' && value !== 0 ? (e) => handlePointerDown(e, idx) : undefined}
              onPointerUp={phase === 'playing' && value !== 0 ? (e) => handlePointerUp(e, idx) : undefined}
            />
          )
        })}
      </motion.div>

      {/* Action buttons */}
      {phase === 'playing' && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="flex gap-3 w-full max-w-sm">
          <button className="btn-secondary flex-1" style={{ minHeight: 44 }} onClick={showHint}>
            💡 Dica
          </button>
          <button className="btn-primary flex-1" style={{ minHeight: 44 }} onClick={reshuffleGame}>
            🔀 Embaralhar
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {phase === 'solved' && (
          <SolvedModal
            moves={moves} time={elapsed} size={size}
            isNewRecord={newRecord} best={best}
            onPlayAgain={() => startGame(size)}
            onMenu={() => { stopTimer(); setPhase('menu') }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </AnimatePresence>
    </div>
  )
}

// ── Tile Component ────────────────────────────────────────────────────────────

interface TileProps {
  value: number
  sizePx: number
  isHint: boolean
  isMovable: boolean
  isSolved: boolean
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
}

function Tile({ value, sizePx, isHint, isMovable, isSolved, onPointerDown, onPointerUp }: TileProps) {
  if (value === 0) {
    return (
      <div style={{
        width: sizePx, height: sizePx, borderRadius: 12,
        background: 'rgba(107, 184, 255, 0.06)',
        border: '2px dashed rgba(107, 184, 255, 0.22)',
      }} />
    )
  }

  const fontSize = sizePx > 80 ? '2rem' : '1.35rem'

  let background = 'white'
  let borderStyle = '2px solid rgba(167, 139, 250, 0.2)'
  let boxShadow = '0 2px 6px rgba(167, 139, 250, 0.12)'
  let textColor = '#7B5EA7'

  if (isSolved) {
    background = 'linear-gradient(135deg, #86EFAC, #34D399)'
    borderStyle = '2.5px solid #22C55E'
    boxShadow = '0 3px 10px rgba(52, 211, 153, 0.4)'
    textColor = 'white'
  } else if (isHint) {
    background = 'linear-gradient(135deg, #FEF3C7, #FDE68A)'
    borderStyle = '3px solid #FCD34D'
    boxShadow = '0 0 0 3px #FCD34D, 0 4px 14px rgba(252, 211, 77, 0.45)'
    textColor = '#92400E'
  } else if (isMovable) {
    background = 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #6BB8FF, #A78BFA) border-box'
    borderStyle = '2.5px solid transparent'
    boxShadow = '0 4px 14px rgba(107, 184, 255, 0.28)'
  }

  return (
    <motion.div
      layout
      layoutId={`puzzle-tile-${value}`}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      style={{
        width: sizePx, height: sizePx, borderRadius: 12,
        cursor: isMovable ? 'pointer' : 'default',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        background,
        border: borderStyle,
        boxShadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      whileHover={isMovable ? { scale: 1.07, y: -2 } : undefined}
      whileTap={isMovable ? { scale: 0.92 } : undefined}
      animate={isHint ? { scale: [1, 1.1, 1, 1.1, 1] } : {}}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <span style={{
        fontFamily: "'Fredoka One', cursive",
        fontSize, fontWeight: 700, color: textColor,
        lineHeight: 1, pointerEvents: 'none',
        textShadow: isSolved ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
      }}>
        {value}
      </span>
    </motion.div>
  )
}

// ── Mode Card ────────────────────────────────────────────────────────────────

function ModeCard({ label, subtitle, emoji, onClick, best }: {
  label: string; subtitle: string; emoji: string; onClick: () => void; best: BestScore | null
}) {
  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
      onClick={onClick} className="w-full text-left rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: 'linear-gradient(135deg, rgba(107,184,255,0.1), rgba(167,139,250,0.1))',
        border: '2px solid rgba(167,139,250,0.22)',
        cursor: 'pointer', minHeight: 72,
      }}>
      <span className="text-3xl">{emoji}</span>
      <div className="flex-1">
        <div className="text-xl font-black" style={{ fontFamily: "'Fredoka One', cursive", color: '#6BB8FF' }}>{label}</div>
        <div className="text-sm font-bold" style={{ color: '#7B5EA7' }}>{subtitle}</div>
        {best
          ? <div className="text-xs mt-1" style={{ color: '#A78BFA' }}>🏆 Recorde: {best.moves} mov · {formatTime(best.time)}</div>
          : <div className="text-xs mt-1" style={{ color: '#C4B5FD' }}>Sem recorde ainda</div>
        }
      </div>
      <span className="text-xl" style={{ color: '#A78BFA' }}>▶</span>
    </motion.button>
  )
}

// ── Solved Modal ──────────────────────────────────────────────────────────────

function SolvedModal({ moves, time, size, isNewRecord, best, onPlayAgain, onMenu }: {
  moves: number; time: number; size: GridSize; isNewRecord: boolean;
  best: BestScore | null; onPlayAgain: () => void; onMenu: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <motion.div
        initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="glass-card p-7 w-full max-w-xs text-center flex flex-col gap-4">

        <motion.div animate={{ rotate: [0,-10,10,-10,10,0], scale: [1,1.2,1] }}
          transition={{ duration: 0.6 }} className="text-6xl">🎉</motion.div>

        <div>
          <h2 className="text-3xl font-black" style={{ fontFamily: "'Fredoka One', cursive", color: '#6BB8FF' }}>
            PARABÉNS!
          </h2>
          <p className="text-base font-bold mt-1" style={{ color: '#7B5EA7' }}>
            Quebra-cabeça {size}×{size} resolvido!
          </p>
        </div>

        {isNewRecord && (
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
            className="rounded-2xl py-2 px-4 text-sm font-black"
            style={{ background: 'linear-gradient(135deg, #FCD34D, #F59E0B)', color: 'white' }}>
            🏆 Novo Recorde!
          </motion.div>
        )}

        <div className="rounded-2xl p-4 flex justify-around"
          style={{ background: 'rgba(107,184,255,0.08)', border: '1.5px solid rgba(107,184,255,0.2)' }}>
          <div>
            <div className="text-2xl font-black" style={{ color: '#6BB8FF' }}>{moves}</div>
            <div className="text-xs font-bold" style={{ color: '#A78BFA' }}>MOVIMENTOS</div>
          </div>
          <div style={{ width: 1, background: 'rgba(167,139,250,0.2)' }} />
          <div>
            <div className="text-2xl font-black" style={{ color: '#A78BFA' }}>{formatTime(time)}</div>
            <div className="text-xs font-bold" style={{ color: '#A78BFA' }}>TEMPO</div>
          </div>
        </div>

        {best && !isNewRecord && (
          <div className="text-xs" style={{ color: '#A78BFA' }}>
            🏆 Recorde: {best.moves} mov · {formatTime(best.time)}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button className="btn-primary" style={{ minHeight: 48, fontSize: '1.05rem' }} onClick={onPlayAgain}>
            🔄 Jogar Novamente
          </button>
          <button className="btn-secondary" style={{ minHeight: 44 }} onClick={onMenu}>
            🏠 Menu
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Help Modal ────────────────────────────────────────────────────────────────

function HelpModal({ onClose }: { onClose: () => void }) {
  const rules = [
    ['🔢', 'Organize as peças em ordem crescente: 1, 2, 3… até o fim.'],
    ['👆', 'Toque em uma peça ao lado do espaço vazio para deslizá-la.'],
    ['↔️',  'Arraste a peça em direção ao espaço vazio para movê-la.'],
    ['⌨️', 'No computador, use as teclas de seta para mover as peças.'],
    ['💡', 'Clique em "Dica" para destacar a peça sugerida (fica amarela).'],
    ['🔀', 'Use "Embaralhar" para reiniciar com um novo embaralhamento.'],
    ['🏆', 'Resolva com menos movimentos e no menor tempo possível!'],
  ]
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 30 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="glass-card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-black mb-4 text-center"
          style={{ fontFamily: "'Fredoka One', cursive", color: '#6BB8FF' }}>
          ❓ Como Jogar
        </h2>
        <ul className="flex flex-col gap-3 text-sm font-bold" style={{ color: '#7B5EA7' }}>
          {rules.map(([icon, text], i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="text-lg flex-shrink-0">{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <button className="btn-primary w-full mt-5" style={{ minHeight: 48 }} onClick={onClose}>
          Entendido! 🎮
        </button>
      </motion.div>
    </motion.div>
  )
}
