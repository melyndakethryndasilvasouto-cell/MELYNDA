import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'showing' | 'input' | 'wrong' | 'victory-milestone' | 'game-over'

interface ColorConfig {
  id: number
  label: string
  freq: number
  base: string
  lit: string
  shadow: string
  textColor: string
}

// ─── Color definitions ────────────────────────────────────────────────────────
const COLORS: ColorConfig[] = [
  {
    id: 0,
    label: 'AZUL',
    freq: 262,
    base: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
    lit: 'linear-gradient(135deg, #93C5FD, #60A5FA)',
    shadow: '#3B82F6',
    textColor: '#ffffff',
  },
  {
    id: 1,
    label: 'VERMELHO',
    freq: 330,
    base: 'linear-gradient(135deg, #EF4444, #DC2626)',
    lit: 'linear-gradient(135deg, #FCA5A5, #F87171)',
    shadow: '#EF4444',
    textColor: '#ffffff',
  },
  {
    id: 2,
    label: 'AMARELO',
    freq: 392,
    base: 'linear-gradient(135deg, #EAB308, #CA8A04)',
    lit: 'linear-gradient(135deg, #FDE68A, #FCD34D)',
    shadow: '#EAB308',
    textColor: '#78350f',
  },
  {
    id: 3,
    label: 'VERDE',
    freq: 523,
    base: 'linear-gradient(135deg, #22C55E, #16A34A)',
    lit: 'linear-gradient(135deg, #86EFAC, #4ADE80)',
    shadow: '#22C55E',
    textColor: '#ffffff',
  },
]

// ─── Milestone messages ───────────────────────────────────────────────────────
const MILESTONES: Record<number, string> = {
  5:  'Incrível! 🌟',
  10: 'Gênio! 🧠',
  15: 'Lendário! 🦄',
  20: 'Imparável! 🚀',
  25: 'Mestre Simon! 👑',
}

const GAME_NAME = 'simon-says'
const LS_BEST = 'mel-simon-best'

// ─── Audio (singleton AudioContext) ──────────────────────────────────────────
let _simonCtx: AudioContext | null = null
let _simonAudioReady: Promise<void> | null = null

function getSimonCtx(): AudioContext {
  if (!_simonCtx || _simonCtx.state === 'closed') {
    _simonCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return _simonCtx
}

function resumeSimonCtx(ctx: AudioContext) {
  if (ctx.state === 'running') return Promise.resolve()
  if (!_simonAudioReady) {
    _simonAudioReady = ctx.resume().catch(() => {}).finally(() => { _simonAudioReady = null })
  }
  return _simonAudioReady
}

function unlockSimonAudio(isMuted: boolean) {
  if (isMuted) return
  try { void resumeSimonCtx(getSimonCtx()) } catch {}
}

function playSimonTone(colorIndex: number, isMuted: boolean) {
  if (isMuted) return
  try {
    const ctx = getSimonCtx()
    void resumeSimonCtx(ctx).then(() => {
      if (ctx.state !== 'running') return
      const start = ctx.currentTime
      const freqs = [262, 330, 392, 523]
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freqs[colorIndex]
      gain.gain.setValueAtTime(0.45, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55)
      osc.start(start)
      osc.stop(start + 0.55)
    }).catch(() => {})
  } catch {}
}

function playErrorBuzz(isMuted: boolean) {
  if (isMuted) return
  try {
    const ctx = getSimonCtx()
    void resumeSimonCtx(ctx).then(() => {
      if (ctx.state !== 'running') return
      const start = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.value = 160
      gain.gain.setValueAtTime(0.35, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6)
      osc.start(start)
      osc.stop(start + 0.6)
    }).catch(() => {})
  } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SimonSays() {
  const { isMuted, playSound } = useSound()
  const { updateScore } = usePlayer()

  const [phase, setPhase] = useState<Phase>('idle')
  const [sequence, setSequence] = useState<number[]>([])
  const [playerIndex, setPlayerIndex] = useState(0)
  const [litButton, setLitButton] = useState<number | null>(null)
  const [allLit, setAllLit] = useState(false)
  const [strictMode, setStrictMode] = useState(false)
  const [score, setScore] = useState(0)
  const [milestoneMsg, setMilestoneMsg] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [bestScore, setBestScore] = useState<number>(() => {
    const s = parseInt(localStorage.getItem(LS_BEST) || '0', 10)
    return isNaN(s) ? 0 : s
  })
  const prevBestRef = useRef(0)

  const sequenceRef = useRef<number[]>([])
  const playerIndexRef = useRef(0)
  const scoreRef = useRef(0)
  const isMutedRef = useRef(isMuted)
  const strictModeRef = useRef(strictMode)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { strictModeRef.current = strictMode }, [strictMode])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }, [])

  useEffect(() => { sequenceRef.current = sequence }, [sequence])
  useEffect(() => { playerIndexRef.current = playerIndex }, [playerIndex])
  useEffect(() => { scoreRef.current = score }, [score])

  function stepDuration(round: number): number {
    if (round <= 5)  return 600
    if (round <= 10) return 450
    return 300
  }

  const playSequenceAnim = useCallback((seq: number[]) => {
    setPhase('showing')
    setLitButton(null)
    setAllLit(false)

    const round = seq.length
    const dur = stepDuration(round)
    const onDur = Math.round(dur * 0.65)
    const offDur = dur - onDur
    let delay = 500

    seq.forEach((colorIdx, i) => {
      addTimeout(() => {
        setLitButton(colorIdx)
        playSimonTone(colorIdx, isMutedRef.current)
      }, delay)

      delay += onDur
      addTimeout(() => setLitButton(null), delay)
      delay += offDur

      if (i === seq.length - 1) {
        addTimeout(() => {
          setPhase('input')
          setPlayerIndex(0)
          playerIndexRef.current = 0
        }, delay + 100)
      }
    })
  }, [addTimeout])

  const advanceRound = useCallback((currentSeq: number[], currentScore: number) => {
    clearAllTimeouts()
    const newScore = currentSeq.length
    setScore(newScore)
    scoreRef.current = newScore
    updateScore(GAME_NAME, newScore)

    setBestScore(prev => {
      if (newScore > prev) {
        localStorage.setItem(LS_BEST, String(newScore))
        return newScore
      }
      return prev
    })

    const msg = MILESTONES[newScore]
    if (msg) {
      playSound('win')
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#6BB8FF', '#A78BFA', '#ffffff', '#FCD34D'],
      })
      setMilestoneMsg(msg)
      setPhase('victory-milestone')

      addTimeout(() => {
        const nextColor = Math.floor(Math.random() * 4)
        const nextSeq = [...currentSeq, nextColor]
        setSequence(nextSeq)
        sequenceRef.current = nextSeq
        playSequenceAnim(nextSeq)
      }, 2700)
    } else {
      const nextColor = Math.floor(Math.random() * 4)
      const nextSeq = [...currentSeq, nextColor]
      setSequence(nextSeq)
      sequenceRef.current = nextSeq
      addTimeout(() => playSequenceAnim(nextSeq), 800)
    }
  }, [clearAllTimeouts, updateScore, playSound, addTimeout, playSequenceAnim])

  const handleWrong = useCallback((currentScore: number) => {
    clearAllTimeouts()
    setAllLit(true)
    playErrorBuzz(isMutedRef.current)
    playSound('lose')

    setBestScore(prev => {
      if (currentScore > prev) {
        localStorage.setItem(LS_BEST, String(currentScore))
        return currentScore
      }
      return prev
    })
    updateScore(GAME_NAME, currentScore)

    addTimeout(() => {
      setAllLit(false)
      setPhase('wrong')
    }, 800)
  }, [clearAllTimeouts, playSound, updateScore, addTimeout])

  const handleButtonPress = useCallback((colorIdx: number) => {
    if (phase !== 'input') return

    unlockSimonAudio(isMutedRef.current)
    playSimonTone(colorIdx, isMutedRef.current)
    setLitButton(colorIdx)
    addTimeout(() => setLitButton(null), 200)

    const seq = sequenceRef.current
    const idx = playerIndexRef.current
    const expected = seq[idx]

    if (colorIdx !== expected) {
      // In strict mode, restart from zero after showing error
      if (strictModeRef.current) {
        clearAllTimeouts()
        setAllLit(true)
        playErrorBuzz(isMutedRef.current)
        playSound('lose')
        setBestScore(prev => {
          const s = scoreRef.current
          if (s > prev) { localStorage.setItem(LS_BEST, String(s)); return s }
          return prev
        })
        updateScore(GAME_NAME, scoreRef.current)
        addTimeout(() => {
          setAllLit(false)
          // strict mode: full restart
          setScore(0); scoreRef.current = 0
          setPlayerIndex(0); playerIndexRef.current = 0
          setLitButton(null); setMilestoneMsg('')
          const fc = Math.floor(Math.random() * 4)
          const ns = [fc]
          setSequence(ns); sequenceRef.current = ns
          playSequenceAnim(ns)
        }, 900)
      } else {
        handleWrong(scoreRef.current)
      }
    } else {
      const nextIdx = idx + 1
      if (nextIdx === seq.length) {
        setPhase('showing')
        playSound('match')
        advanceRound(seq, scoreRef.current)
      } else {
        setPlayerIndex(nextIdx)
        playerIndexRef.current = nextIdx
      }
    }
  }, [phase, addTimeout, handleWrong, playSound, advanceRound, clearAllTimeouts, updateScore, playSequenceAnim])

  const handleButtonInteraction = useCallback((colorIdx: number) => {
    handleButtonPress(colorIdx)
  }, [handleButtonPress])

  const startGame = useCallback(() => {
    unlockSimonAudio(isMutedRef.current)
    playSound('click')
    clearAllTimeouts()
    setScore(0)
    scoreRef.current = 0
    setPlayerIndex(0)
    playerIndexRef.current = 0
    setLitButton(null)
    setAllLit(false)
    setMilestoneMsg('')

    const firstColor = Math.floor(Math.random() * 4)
    const newSeq = [firstColor]
    setSequence(newSeq)
    sequenceRef.current = newSeq
    playSequenceAnim(newSeq)
  }, [clearAllTimeouts, playSequenceAnim, playSound])

  useEffect(() => () => clearAllTimeouts(), [clearAllTimeouts])

  function isLit(id: number): boolean {
    if (allLit) return true
    return litButton === id
  }

  const canPress = phase === 'input'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 py-6 select-none"
      style={{ fontFamily: 'Nunito, sans-serif' }}
    >
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <div className="flex flex-col items-start">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}
          >
            Sequência de Cores
          </h1>
          <p className="text-sm" style={{ color: '#4A90D9' }}>
            Repita a ordem das cores! 🎨
          </p>
        </div>
        <button
          className="btn-secondary text-sm px-3 py-2"
          style={{ minHeight: 44, minWidth: 44 }}
          onClick={() => { playSound('click'); setShowHelp(true) }}
          aria-label="Ajuda"
        >
          ❓ Ajuda
        </button>
      </div>

      {/* Score bar */}
      <div className="w-full max-w-lg glass-card p-4 mb-5 flex items-center justify-between">
        <div className="text-center flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Rodada</div>
          <div className="text-3xl font-bold" style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}>
            {sequence.length > 0 ? sequence.length : '—'}
          </div>
        </div>
        <div className="text-center flex-1 border-x border-purple-100 px-3">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Pontuação</div>
          <div className="text-3xl font-bold" style={{ fontFamily: 'Fredoka One, cursive', color: '#4A90D9' }}>
            {score}
          </div>
        </div>
        <div className="text-center flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Recorde</div>
          <div className="text-3xl font-bold" style={{ fontFamily: 'Fredoka One, cursive', color: '#F59E0B' }}>
            {bestScore}
          </div>
        </div>
      </div>

      {/* Phase indicator */}
      <div className="mb-4 h-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 'showing' && (
            <motion.div
              key="showing"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="px-4 py-1 rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(90deg, #A78BFA, #6BB8FF)' }}
            >
              👀 Observe a sequência...
            </motion.div>
          )}
          {phase === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="px-4 py-1 rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(90deg, #22C55E, #16A34A)' }}
            >
              👆 Sua vez! ({playerIndex + 1}/{sequence.length})
            </motion.div>
          )}
          {phase === 'idle' && sequence.length === 0 && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-semibold"
              style={{ color: '#9CA3AF' }}
            >
              Pressione Iniciar para jogar!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2×2 Color Grid */}
      <div
        className="grid grid-cols-2 gap-4 w-full mb-6 game-area"
        style={{ maxWidth: 420 }}
      >
        {COLORS.map((color) => {
          const lit = isLit(color.id)
          const pressable = canPress && !allLit
          return (
            <motion.button
              key={color.id}
              aria-label={color.label}
              disabled={!pressable}
              onClick={() => pressable && handleButtonInteraction(color.id)}
              
              animate={lit ? { scale: 1.05 } : { scale: 1 }}
              whileTap={pressable ? { scale: 0.92 } : {}}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              style={{
                background: lit ? color.lit : color.base,
                boxShadow: lit
                  ? `0 0 48px 16px ${color.shadow}99, 0 8px 28px ${color.shadow}66`
                  : `0 6px 20px ${color.shadow}44`,
                minHeight: 140,
                borderRadius: 24,
                border: 'none',
                cursor: pressable ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.1s, box-shadow 0.1s',
                outline: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  fontFamily: 'Fredoka One, cursive',
                  fontSize: 'clamp(1.1rem, 5vw, 1.5rem)',
                  color: lit ? '#1a1a1a' : color.textColor,
                  letterSpacing: '0.05em',
                  textShadow: lit ? 'none' : '0 1px 3px rgba(0,0,0,0.22)',
                  pointerEvents: 'none',
                }}
              >
                {color.label}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Controls */}
      <div className="w-full flex flex-col gap-3" style={{ maxWidth: 420 }}>
        {phase === 'idle' && sequence.length === 0 ? (
          <button
            className="btn-primary w-full py-3 text-lg"
            style={{ minHeight: 52, fontFamily: 'Fredoka One, cursive' }}
            onClick={startGame}
          >
            🎮 Iniciar Jogo
          </button>
        ) : (
          <button
            className="btn-secondary w-full py-3 text-base"
            style={{ minHeight: 52 }}
            onClick={startGame}
          >
            🔄 Reiniciar
          </button>
        )}

        <button
          className="w-full py-3 text-base rounded-2xl font-semibold transition-all"
          style={{
            minHeight: 48,
            background: strictMode
              ? 'linear-gradient(135deg, #F97316, #DC2626)'
              : 'white',
            color: strictMode ? '#ffffff' : '#7B5EA7',
            border: strictMode ? 'none' : '2px solid #A78BFA',
            boxShadow: strictMode ? '0 4px 14px rgba(220,38,38,0.35)' : 'none',
          }}
          onClick={() => {
            playSound('click')
            setStrictMode(prev => !prev)
          }}
        >
          {strictMode ? '🔴 Modo Estrito: ATIVADO' : '⚪ Modo Estrito: DESATIVADO'}
        </button>
      </div>

      {/* Bottom legend */}
      <div className="w-full mt-4 flex gap-3 flex-wrap justify-center" style={{ maxWidth: 420 }}>
        {COLORS.map(c => (
          <div key={c.id} className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
            <div className="rounded-full" style={{ width: 12, height: 12, background: c.base }} />
            <span>{c.label} · {c.freq}Hz</span>
          </div>
        ))}
      </div>

      {/* ─── Overlays ─── */}
      <AnimatePresence>

        {/* Game Over */}
        {phase === 'wrong' && (
          <motion.div
            key="gameover-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 px-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              key="gameover-card"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="glass-card p-8 text-center w-full"
              style={{ maxWidth: 380 }}
            >
              <div className="text-6xl mb-3">😢</div>
              <h2
                className="text-3xl font-bold mb-2"
                style={{ fontFamily: 'Fredoka One, cursive', color: '#DC2626' }}
              >
                Errou!
              </h2>
              {strictMode && (
                <div
                  className="text-sm font-semibold mb-3 px-3 py-1 rounded-full inline-block"
                  style={{ background: '#FEE2E2', color: '#B91C1C' }}
                >
                  🔴 Modo Estrito — reiniciando do zero
                </div>
              )}
              <div className="flex gap-6 justify-center my-4">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Pontuação</div>
                  <div className="text-4xl font-bold" style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}>{score}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wide" style={{ color: '#9CA3AF' }}>Recorde</div>
                  <div className="text-4xl font-bold" style={{ fontFamily: 'Fredoka One, cursive', color: '#F59E0B' }}>{bestScore}</div>
                </div>
              </div>
              {score > 0 && score >= bestScore && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm font-bold mb-3"
                  style={{ color: '#F59E0B' }}
                >
                  🎉 Novo recorde pessoal!
                </motion.div>
              )}
              <div className="flex gap-3 mt-5">
                <button
                  className="btn-primary flex-1 py-3"
                  style={{ minHeight: 52, fontFamily: 'Fredoka One, cursive', fontSize: '1.1rem' }}
                  onClick={startGame}
                >
                  🔄 Jogar Novamente
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Milestone */}
        {phase === 'victory-milestone' && (
          <motion.div
            key="milestone-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 px-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
          >
            <motion.div
              key="milestone-card"
              initial={{ scale: 0.5, rotate: -6, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="glass-card p-8 text-center w-full"
              style={{ maxWidth: 360 }}
            >
              <div className="text-6xl mb-3">🏆</div>
              <h2
                className="text-3xl font-bold mb-2"
                style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}
              >
                {milestoneMsg}
              </h2>
              <p className="text-base" style={{ color: '#4A90D9' }}>
                Você completou{' '}
                <span className="font-bold" style={{ color: '#7B5EA7' }}>{score} rodadas!</span>
              </p>
              <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>
                Continuando em instantes...
              </p>
              <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: '#E9D5FF' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #6BB8FF, #A78BFA)' }}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 2.6, ease: 'linear' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <motion.div
            key="help-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 px-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => { playSound('click'); setShowHelp(false) }}
          >
            <motion.div
              key="help-card"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="glass-card p-6 w-full"
              style={{ maxWidth: 400 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-xl font-bold"
                  style={{ fontFamily: 'Fredoka One, cursive', color: '#7B5EA7' }}
                >
                  ❓ Como Jogar
                </h2>
                <button
                  className="btn-secondary px-3 py-1 text-sm"
                  style={{ minHeight: 36 }}
                  onClick={() => { playSound('click'); setShowHelp(false) }}
                >
                  ✕ Fechar
                </button>
              </div>

              <div className="space-y-3 text-sm" style={{ color: '#374151' }}>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">👀</span>
                  <p><strong>Observe:</strong> O Simon vai iluminar uma sequência de cores. Preste atenção!</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">👆</span>
                  <p><strong>Repita:</strong> Clique nas cores <em>na mesma ordem</em> que o Simon mostrou.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">📈</span>
                  <p><strong>Avance:</strong> A cada rodada a sequência cresce +1. A velocidade também aumenta!</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">❌</span>
                  <p><strong>Errou?</strong> O jogo termina e mostra sua pontuação.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">🔴</span>
                  <p><strong>Modo Estrito:</strong> Ao errar, a sequência reinicia do zero!</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-xl">🌟</span>
                  <p><strong>Conquistas:</strong> Mensagens especiais a cada 5 rodadas!</p>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-2xl" style={{ background: '#F3EEFF' }}>
                <p className="text-xs font-semibold text-center" style={{ color: '#7B5EA7' }}>
                  🎵 Cada cor tem um som diferente — use seus ouvidos também!
                </p>
              </div>

              <button
                className="btn-primary w-full mt-4 py-3"
                style={{ minHeight: 48 }}
                onClick={() => { playSound('click'); setShowHelp(false) }}
              >
                Entendido! Vamos jogar 🎮
              </button>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
