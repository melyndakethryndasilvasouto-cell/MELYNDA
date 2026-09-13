import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'
import { applyChessMove, createChessState, legalChessMoves } from '../../online/chessRules.mjs'
import { chooseChessMove } from '../../online/chessAi.mjs'

type Position = [number, number]
type Difficulty = 'easy' | 'medium' | 'hard'
type ChessState = ReturnType<typeof createChessState>

const SYMBOLS: Record<string, string> = {
  whiteking: '♔', whitequeen: '♕', whiterook: '♖', whitebishop: '♗', whiteknight: '♘', whitepawn: '♙',
  blackking: '♚', blackqueen: '♛', blackrook: '♜', blackbishop: '♝', blackknight: '♞', blackpawn: '♟',
}
const PIECE_NAMES: Record<string, string> = {
  king: 'rei', queen: 'dama', rook: 'torre', bishop: 'bispo', knight: 'cavalo', pawn: 'peão',
}
const LEVELS: Array<{ id: Difficulty; label: string; detail: string; icon: string }> = [
  { id: 'easy', label: 'Fácil (baixo)', detail: 'Jogadas variadas para aprender', icon: '🌱' },
  { id: 'medium', label: 'Médio', detail: 'Percebe capturas e perigos', icon: '🧠' },
  { id: 'hard', label: 'Difícil (alto)', detail: 'Planeja algumas jogadas à frente', icon: '🏆' },
]

const samePosition = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1]
const levelLabel = (level: Difficulty) => LEVELS.find(item => item.id === level)?.label ?? 'Médio'

export default function ChessGame() {
  const { playSound } = useSound()
  const { updateScore } = usePlayer()
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [started, setStarted] = useState(false)
  const [gameState, setGameState] = useState<ChessState>(() => createChessState())
  const [selected, setSelected] = useState<Position | null>(null)
  const [thinking, setThinking] = useState(false)
  const rewarded = useRef(false)

  const resetGame = useCallback((start = true) => {
    rewarded.current = false
    setGameState(createChessState())
    setSelected(null)
    setThinking(false)
    setStarted(start)
  }, [])

  const changeDifficulty = (next: Difficulty) => {
    playSound('click')
    setDifficulty(next)
    if (started) resetGame(true)
  }

  const finishFeedback = useCallback((next: ChessState) => {
    if (next.phase !== 'finished') {
      playSound('click')
      return
    }
    if (next.winner === 'host') {
      playSound('win')
      if (!rewarded.current) {
        rewarded.current = true
        updateScore('chess', difficulty === 'hard' ? 300 : difficulty === 'medium' ? 200 : 100)
      }
    } else if (next.winner === 'guest') playSound('lose')
    else playSound('match')
  }, [difficulty, playSound, updateScore])

  useEffect(() => {
    if (!started || gameState.phase !== 'playing' || gameState.turn !== 'black') return
    let cancelled = false
    setThinking(true)
    const timer = window.setTimeout(() => {
      if (cancelled) return
      const move = chooseChessMove(gameState, difficulty)
      if (!move) {
        setThinking(false)
        return
      }
      const next = applyChessMove(gameState, move.from, move.to, move.promotion)
      if (cancelled) return
      setGameState(next)
      setThinking(false)
      finishFeedback(next)
    }, 420)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [difficulty, finishFeedback, gameState, started])

  const legalTargets = useMemo(
    () => selected ? legalChessMoves(gameState, selected) as Position[] : [],
    [gameState, selected],
  )

  const chooseSquare = (row: number, col: number) => {
    if (!started || thinking || gameState.phase !== 'playing' || gameState.turn !== 'white') return
    const position: Position = [row, col]
    const current = gameState.board[row][col]

    if (selected && legalTargets.some(target => samePosition(target, position))) {
      const next = applyChessMove(gameState, selected, position)
      setSelected(null)
      setGameState(next)
      finishFeedback(next)
      return
    }

    if (current?.color === 'white') {
      setSelected(position)
      playSound('click')
    } else {
      setSelected(null)
    }
  }

  const status = gameState.phase === 'finished'
    ? gameState.winner === 'host' ? 'Parabéns, você venceu!'
      : gameState.winner === 'guest' ? 'O sistema venceu. Respire e tente novamente!'
        : 'Empate! Vocês jogaram com equilíbrio.'
    : gameState.checked === gameState.turn
      ? gameState.turn === 'white' ? 'Atenção: seu rei está em xeque!' : 'Muito bem: o rei do sistema está em xeque!'
      : thinking || gameState.turn === 'black' ? 'O sistema está pensando…' : 'Sua vez: escolha uma peça branca.'

  if (!started) {
    return <div className="flex min-h-[70vh] items-center justify-center p-4" style={{ fontFamily: 'Nunito, sans-serif' }}>
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="glass-card w-full max-w-lg p-6 text-center" aria-labelledby="chess-setup-title">
        <div className="text-6xl" aria-hidden="true">♟️</div>
        <h1 id="chess-setup-title" className="font-title mt-2 text-3xl" style={{ color: '#5B3A8A' }}>Xadrez com Sabedoria</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm font-bold text-gray-700">Você joga com as peças brancas contra o sistema. Escolha um nível e aprenda no seu ritmo.</p>
        <fieldset className="mt-6 grid gap-3">
          <legend className="mb-3 font-black text-gray-800">Escolha a dificuldade</legend>
          {LEVELS.map(level => <button key={level.id} type="button" aria-pressed={difficulty === level.id} onClick={() => changeDifficulty(level.id)}
            className={difficulty === level.id ? 'btn-primary min-h-14' : 'btn-secondary min-h-14'}>
            <span className="block font-black">{level.icon} {level.label}</span>
            <span className="block text-xs opacity-90">{level.detail}</span>
          </button>)}
        </fieldset>
        <button type="button" className="btn-primary mt-5 min-h-14 w-full text-lg" onClick={() => { playSound('click'); resetGame(true) }}>▶ Começar partida</button>
        <aside className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          “O Senhor é quem dá sabedoria.” — Provérbios 2:6
        </aside>
      </motion.section>
    </div>
  }

  return <div className="min-h-[70vh] p-2 sm:p-4" style={{ fontFamily: 'Nunito, sans-serif' }}>
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="local-chess-title">
      <header className="glass-card mb-3 flex flex-wrap items-center justify-between gap-2 p-3">
        <button type="button" className="btn-secondary min-h-11 px-3 text-sm" onClick={() => { playSound('click'); resetGame(false) }}>← Níveis</button>
        <div className="text-center">
          <h1 id="local-chess-title" className="font-title text-xl sm:text-2xl" style={{ color: '#5B3A8A' }}>♟️ Xadrez com Sabedoria</h1>
          <p className="text-xs font-black text-gray-600">Você: brancas · Sistema: pretas</p>
        </div>
        <button type="button" className="btn-secondary min-h-11 px-3 text-sm" onClick={() => { playSound('click'); resetGame(true) }}>↻ Reiniciar</button>
      </header>

      <div className="glass-card mb-3 flex flex-wrap items-center justify-center gap-2 p-3" aria-label="Trocar nível de dificuldade">
        <span className="mr-1 text-sm font-black text-gray-700">Nível:</span>
        {LEVELS.map(level => <button key={level.id} type="button" aria-pressed={difficulty === level.id} disabled={thinking}
          className={difficulty === level.id ? 'btn-primary min-h-11 px-3 text-sm' : 'btn-secondary min-h-11 px-3 text-sm'}
          onClick={() => changeDifficulty(level.id)}>{level.icon} {level.label}</button>)}
      </div>

      <div className="glass-card mb-3 p-3 text-center" role="status" aria-live="polite" aria-atomic="true">
        <p className="font-black" style={{ color: gameState.checked === 'white' ? '#B91C1C' : '#166534' }}>{status}</p>
        <p className="mt-1 text-xs font-bold text-gray-600">Nível {levelLabel(difficulty)} · Jogue com calma, coragem e respeito.</p>
      </div>

      <div className="glass-card mx-auto w-fit max-w-full p-2 sm:p-3">
        <div className="grid w-[min(88vw,34rem)] grid-cols-8 overflow-hidden rounded-xl border-4 border-amber-900" role="grid" aria-label="Tabuleiro de xadrez. As peças brancas começam na parte de baixo.">
          {Array.from({ length: 64 }, (_, index) => {
            const row = Math.floor(index / 8)
            const col = index % 8
            const current = gameState.board[row][col]
            const active = selected?.[0] === row && selected?.[1] === col
            const target = legalTargets.some(square => square[0] === row && square[1] === col)
            const coordinate = `${String.fromCharCode(97 + col)}${8 - row}`
            const label = current
              ? `${PIECE_NAMES[current.type]} ${current.color === 'white' ? 'branco' : 'preto'} em ${coordinate}${active ? ', selecionado' : ''}`
              : `Casa ${coordinate} vazia${target ? ', movimento permitido' : ''}`
            return <button key={`${row}-${col}`} type="button" role="gridcell" aria-label={label} aria-selected={active}
              disabled={thinking || gameState.phase === 'finished'} onClick={() => chooseSquare(row, col)}
              className="relative flex aspect-square min-h-9 items-center justify-center text-[clamp(1.4rem,7vw,3rem)] leading-none focus:z-10 focus:outline focus:outline-4 focus:outline-blue-600 disabled:opacity-100"
              style={{
                background: active ? '#FDE047' : target ? '#86EFAC' : (row + col) % 2 ? '#A16207' : '#FEF3C7',
                color: current?.color === 'white' ? '#FFFFFF' : '#111827',
                textShadow: current?.color === 'white' ? '0 1px 2px #111827' : '0 1px 1px #FFFFFF',
              }}>
              {current ? SYMBOLS[`${current.color}${current.type}`] : target ? <span className="h-3 w-3 rounded-full bg-green-800/70" aria-hidden="true" /> : null}
            </button>
          })}
        </div>
      </div>

      <aside className="glass-card mx-auto mt-3 max-w-2xl p-3 text-center text-xs font-bold text-gray-700">
        Toque em uma peça branca e depois em uma casa verde. O jogo aceita roque, en passant, xeque-mate e promove o peão automaticamente para dama.
      </aside>
    </section>
  </div>
}
