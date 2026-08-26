import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

// ─── Types ───────────────────────────────────────────────────────────────────

type Cell = 'X' | 'O' | null
type Board = Cell[]
type GameMode = 'menu' | '2p' | 'easy' | 'hard'
type GameStatus = 'playing' | 'win' | 'draw'

interface GameResult {
  status: GameStatus
  winner: Cell
  line: number[] | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

const X_COLOR = '#6BB8FF'
const O_COLOR = '#A78BFA'
const WIN_BG = '#FCD34D'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkResult(board: Board): GameResult {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { status: 'win', winner: board[a], line }
    }
  }
  if (board.every((c) => c !== null)) {
    return { status: 'draw', winner: null, line: null }
  }
  return { status: 'playing', winner: null, line: null }
}

function emptyBoard(): Board {
  return Array(9).fill(null)
}

// ─── Minimax ──────────────────────────────────────────────────────────────────

function minimax(board: Board, isMaximizing: boolean, depth: number): number {
  const result = checkResult(board)
  if (result.status === 'win') return result.winner === 'O' ? 10 - depth : depth - 10
  if (result.status === 'draw') return 0

  const available = board.map((c, i) => (c === null ? i : -1)).filter((i) => i !== -1)

  if (isMaximizing) {
    let best = -Infinity
    for (const idx of available) {
      const next = [...board] as Board
      next[idx] = 'O'
      best = Math.max(best, minimax(next, false, depth + 1))
    }
    return best
  } else {
    let best = Infinity
    for (const idx of available) {
      const next = [...board] as Board
      next[idx] = 'X'
      best = Math.min(best, minimax(next, true, depth + 1))
    }
    return best
  }
}

function bestMove(board: Board): number {
  let best = -Infinity
  let move = -1
  board.forEach((cell, idx) => {
    if (cell !== null) return
    const next = [...board] as Board
    next[idx] = 'O'
    const score = minimax(next, false, 0)
    if (score > best) {
      best = score
      move = idx
    }
  })
  return move
}

function randomMove(board: Board): number {
  const available = board.map((c, i) => (c === null ? i : -1)).filter((i) => i !== -1)
  return available[Math.floor(Math.random() * available.length)]
}

// ─── CellSymbol ───────────────────────────────────────────────────────────────

function CellSymbol({ value }: { value: Cell }) {
  if (!value) return null
  return (
    <motion.span
      key={value}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      style={{
        fontFamily: "'Fredoka One', cursive",
        fontSize: 'clamp(2rem, 6vw, 3.5rem)',
        color: value === 'X' ? X_COLOR : O_COLOR,
        lineHeight: 1,
        userSelect: 'none',
        filter:
          value === 'X'
            ? 'drop-shadow(0 2px 4px rgba(107,184,255,0.5))'
            : 'drop-shadow(0 2px 4px rgba(167,139,250,0.5))',
      }}
    >
      {value}
    </motion.span>
  )
}

// ─── HelpContent ──────────────────────────────────────────────────────────────

function HelpContent({ onClose, playSound }: { onClose: () => void; playSound: (s: 'click') => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-card p-6 max-w-sm w-full"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-2xl mb-3 text-center"
          style={{ fontFamily: "'Fredoka One', cursive", color: '#7B5EA7' }}
        >
          Como Jogar
        </h2>
        <ul
          className="text-gray-700 space-y-2 list-disc list-inside text-sm"
          style={{ fontFamily: 'Nunito' }}
        >
          <li>O tabuleiro é uma grade 3×3.</li>
          <li>
            Jogadores alternam marcando células com{' '}
            <span style={{ color: X_COLOR, fontWeight: 700 }}>X</span> ou{' '}
            <span style={{ color: O_COLOR, fontWeight: 700 }}>O</span>.
          </li>
          <li>Vence quem alinhar 3 marcas na mesma linha, coluna ou diagonal.</li>
          <li>Se todas as células forem preenchidas sem vencedor, é empate!</li>
          <li>
            No modo <strong>IA Difícil</strong> a IA é imbatível — tente pelo empate! 🤯
          </li>
        </ul>
        <button
          className="btn-primary w-full mt-5"
          style={{ minHeight: 44 }}
          onClick={() => { playSound('click'); onClose() }}
        >
          Entendido! 👍
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicTacToe() {
  const { playSound } = useSound()
  const { playerName, updateScore } = usePlayer()

  const [mode, setMode] = useState<GameMode>('menu')
  const [board, setBoard] = useState<Board>(emptyBoard())
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [result, setResult] = useState<GameResult>({ status: 'playing', winner: null, line: null })
  const [isThinking, setIsThinking] = useState(false)
  const [scores, setScores] = useState({ X: 0, draw: 0, O: 0 })
  const [showHelp, setShowHelp] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const playerLabel = playerName || 'Jogador'
  const isAI = mode === 'easy' || mode === 'hard'
  const xLabel = isAI ? playerLabel : `${playerLabel} (X)`
  const oLabel = isAI ? '🤖 IA' : 'Jogador 2 (O)'

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.55 },
      colors: ['#6BB8FF', '#A78BFA', '#ffffff', '#FCD34D'],
    })
  }, [])

  // Process result after placing a piece. Receives current score snapshot so
  // updateScore can see the correct new tally.
  const finaliseMove = useCallback(
    (
      newBoard: Board,
      nextTurn: 'X' | 'O',
      currentX: number,
    ) => {
      const res = checkResult(newBoard)
      setResult(res)

      if (res.status === 'win') {
        const winner = res.winner as 'X' | 'O'
        setScores((s) => ({ ...s, [winner]: s[winner] + 1 }))

        const humanWon = !isAI || winner === 'X'
        if (humanWon) {
          playSound('win')
          fireConfetti()
          updateScore('TicTacToe', currentX + (winner === 'X' ? 1 : 0))
        } else {
          playSound('lose')
        }
        setTimeout(() => setShowResult(true), 450)
      } else if (res.status === 'draw') {
        setScores((s) => ({ ...s, draw: s.draw + 1 }))
        setTimeout(() => setShowResult(true), 450)
      } else {
        setTurn(nextTurn)
      }
    },
    [isAI, playSound, fireConfetti, updateScore],
  )

  // AI move
  useEffect(() => {
    if (result.status !== 'playing') return
    if (!isAI || turn !== 'O') return

    setIsThinking(true)
    const timer = setTimeout(() => {
      setBoard((prev) => {
        const idx = mode === 'hard' ? bestMove(prev) : randomMove(prev)
        if (idx === -1) return prev
        const next = [...prev] as Board
        next[idx] = 'O'
        playSound('click')
        // Read latest X score inside setter to avoid stale closure
        setScores((s) => {
          finaliseMove(next, 'X', s.X)
          return s
        })
        return next
      })
      setIsThinking(false)
    }, 400)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, result.status])

  const handleCellClick = (idx: number) => {
    if (board[idx] || result.status !== 'playing' || isThinking) return
    if (isAI && turn === 'O') return

    playSound('click')
    const next = [...board] as Board
    next[idx] = turn
    setBoard(next)
    setScores((s) => {
      finaliseMove(next, turn === 'X' ? 'O' : 'X', s.X)
      return s
    })
  }

  const restartRound = () => {
    playSound('click')
    setBoard(emptyBoard())
    setTurn('X')
    setResult({ status: 'playing', winner: null, line: null })
    setIsThinking(false)
    setShowResult(false)
  }

  const goToMenu = () => {
    playSound('click')
    setMode('menu')
    setBoard(emptyBoard())
    setTurn('X')
    setResult({ status: 'playing', winner: null, line: null })
    setScores({ X: 0, draw: 0, O: 0 })
    setIsThinking(false)
    setShowResult(false)
  }

  const startGame = (m: GameMode) => {
    playSound('click')
    setMode(m)
    setBoard(emptyBoard())
    setTurn('X')
    setResult({ status: 'playing', winner: null, line: null })
    setScores({ X: 0, draw: 0, O: 0 })
    setIsThinking(false)
    setShowResult(false)
  }

  const resultTitle = () => {
    if (result.status === 'draw') return '🤝 Empate!'
    if (!isAI) return result.winner === 'X' ? `🏆 ${xLabel} venceu!` : `🏆 ${oLabel} venceu!`
    return result.winner === 'X' ? '🏆 Você venceu!' : '😅 IA venceu!'
  }

  // ── MENU ──────────────────────────────────────────────────────────────────
  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8 gap-6">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-2">⭕❌</div>
          <h1
            className="text-4xl md:text-5xl"
            style={{ fontFamily: "'Fredoka One', cursive", color: '#7B5EA7' }}
          >
            Jogo da Velha
          </h1>
          <p className="mt-1 text-gray-500" style={{ fontFamily: 'Nunito' }}>
            Escolha o modo de jogo
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 w-full max-w-sm flex flex-col gap-4"
        >
          <button
            className="btn-primary text-lg py-4"
            style={{ minHeight: 56 }}
            onClick={() => startGame('2p')}
          >
            👥 Dois Jogadores
          </button>
          <button
            className="btn-primary text-lg py-4"
            style={{ minHeight: 56 }}
            onClick={() => startGame('easy')}
          >
            🤖 IA Fácil
          </button>
          <button
            className="btn-primary text-lg py-4"
            style={{ minHeight: 56 }}
            onClick={() => startGame('hard')}
          >
            🤖 IA Difícil (Impossível)
          </button>
        </motion.div>

        <button
          className="btn-secondary text-base px-6 py-3"
          style={{ minHeight: 44 }}
          onClick={() => { playSound('click'); setShowHelp(true) }}
        >
          ❓ Ajuda
        </button>

        <AnimatePresence>
          {showHelp && (
            <HelpContent onClose={() => setShowHelp(false)} playSound={playSound} />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── GAME ──────────────────────────────────────────────────────────────────
  const turnColor = turn === 'X' ? X_COLOR : O_COLOR
  const turnLabel = turn === 'X' ? xLabel : oLabel

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-6 gap-4 game-area">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-md">
        <button
          className="btn-secondary text-sm px-3 py-2"
          style={{ minHeight: 44 }}
          onClick={goToMenu}
        >
          ← Menu
        </button>
        <h1
          className="text-2xl"
          style={{ fontFamily: "'Fredoka One', cursive", color: '#7B5EA7' }}
        >
          Jogo da Velha
        </h1>
        <button
          className="btn-secondary text-sm px-3 py-2"
          style={{ minHeight: 44 }}
          onClick={() => { playSound('click'); setShowHelp(true) }}
        >
          ❓ Ajuda
        </button>
      </div>

      {/* Scoreboard */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card px-6 py-3 w-full max-w-md"
      >
        <div className="flex justify-around items-center text-center">
          <div>
            <p className="text-xs text-gray-500" style={{ fontFamily: 'Nunito' }}>
              {xLabel}
            </p>
            <p
              className="text-3xl font-bold"
              style={{ fontFamily: "'Fredoka One', cursive", color: X_COLOR }}
            >
              {scores.X}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500" style={{ fontFamily: 'Nunito' }}>
              Empates
            </p>
            <p
              className="text-3xl font-bold"
              style={{ fontFamily: "'Fredoka One', cursive", color: '#94a3b8' }}
            >
              {scores.draw}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500" style={{ fontFamily: 'Nunito' }}>
              {oLabel}
            </p>
            <p
              className="text-3xl font-bold"
              style={{ fontFamily: "'Fredoka One', cursive", color: O_COLOR }}
            >
              {scores.O}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Turn indicator */}
      <AnimatePresence mode="wait">
        {result.status === 'playing' && (
          <motion.div
            key={`${turn}-${isThinking}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="text-center"
          >
            {isThinking ? (
              <p className="text-base text-gray-500" style={{ fontFamily: 'Nunito' }}>
                🤖 IA está pensando…
              </p>
            ) : (
              <p className="text-base font-semibold" style={{ fontFamily: 'Nunito', color: turnColor }}>
                Vez de <strong>{turnLabel}</strong>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)', width: '100%', maxWidth: 340 }}
      >
        {board.map((cell, idx) => {
          const isWinCell = result.line?.includes(idx) ?? false
          const clickable =
            !cell && result.status === 'playing' && !isThinking && !(isAI && turn === 'O')

          return (
            <motion.button
              key={idx}
              onClick={() => handleCellClick(idx)}
              whileTap={clickable ? { scale: 0.9 } : {}}
              animate={
                isWinCell
                  ? { backgroundColor: WIN_BG, scale: 1.06 }
                  : { backgroundColor: '#ffffff', scale: 1 }
              }
              transition={{ duration: 0.28 }}
              className="relative flex items-center justify-center rounded-2xl shadow-md border-2"
              style={{
                aspectRatio: '1 / 1',
                minWidth: 80,
                minHeight: 80,
                borderColor: isWinCell ? '#FBBF24' : '#e2e8f0',
                cursor: clickable ? 'pointer' : 'default',
                outline: 'none',
              }}
            >
              <CellSymbol value={cell} />
            </motion.button>
          )
        })}
      </div>

      {/* Restart */}
      <button
        className="btn-secondary text-sm px-5 py-2"
        style={{ minHeight: 44 }}
        onClick={restartRound}
      >
        🔄 Reiniciar Partida
      </button>

      {/* Result modal */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-card p-7 max-w-xs w-full text-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <div className="text-5xl mb-3">
                {result.status === 'draw' ? '🤝' : result.winner === 'X' ? '🏆' : '😅'}
              </div>
              <h2
                className="text-2xl mb-1"
                style={{ fontFamily: "'Fredoka One', cursive", color: '#7B5EA7' }}
              >
                {resultTitle()}
              </h2>

              <div
                className="flex justify-center gap-4 my-3 text-sm"
                style={{ fontFamily: 'Nunito' }}
              >
                <span style={{ color: X_COLOR }}>
                  <strong>{scores.X}</strong> {scores.X === 1 ? 'vitória' : 'vitórias'} de X
                </span>
                <span className="text-gray-400">|</span>
                <span style={{ color: O_COLOR }}>
                  <strong>{scores.O}</strong> {scores.O === 1 ? 'vitória' : 'vitórias'} de O
                </span>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  className="btn-secondary flex-1"
                  style={{ minHeight: 48 }}
                  onClick={goToMenu}
                >
                  🏠 Menu
                </button>
                <button
                  className="btn-primary flex-1"
                  style={{ minHeight: 48 }}
                  onClick={restartRound}
                >
                  🔁 Revanche
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help modal */}
      <AnimatePresence>
        {showHelp && (
          <HelpContent onClose={() => setShowHelp(false)} playSound={playSound} />
        )}
      </AnimatePresence>
    </div>
  )
}
