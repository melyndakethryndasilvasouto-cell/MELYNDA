import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'
import memoryPairs from '../../data/memoryPairs.json'
import { shouldContinueAiTurn } from './aiTurnRules.mjs'

// ─── Types ───────────────────────────────────────────────────────────────────

type GameMode = 'solo' | 'two' | 'ai'
type Difficulty = 'easy' | 'medium' | 'hard'
type Phase = 'menu' | 'playing' | 'victory'

interface CardData {
  id: number
  emoji: string
  title: string
  verseRef: string
  message: string
  pairId: number
  isFlipped: boolean
  isMatched: boolean
}

interface MemoryLesson {
  title: string
  emoji: string
  verseRef: string
  message: string
}

interface ScoreState {
  p1: number
  p2: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; cols: number; pairs: number }> = {
  easy:   { label: 'Fácil (4×3)',   cols: 4, pairs: 6  },
  medium: { label: 'Médio (4×4)',   cols: 4, pairs: 8  },
  hard:   { label: 'Difícil (5×4)', cols: 5, pairs: 10 },
}

const MODE_CONFIG: Record<GameMode, { label: string; icon: string }> = {
  solo: { label: 'Sozinha (vs Tempo)', icon: '🧍' },
  two:  { label: 'Dois Jogadores',     icon: '👥' },
  ai:   { label: 'Vs Computador',      icon: '🤖' },
}

const LS_BEST = (d: Difficulty) => `mel_memory_best_${d}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDeck(pairs: number): CardData[] {
  const lessons = memoryPairs.slice(0, pairs)
  const cards: CardData[] = []
  lessons.forEach((lesson, pairId) => {
    const data = { emoji: lesson.emoji, title: lesson.title, verseRef: lesson.verseRef, message: lesson.message, pairId, isFlipped: false, isMatched: false }
    cards.push({ id: pairId * 2, ...data })
    cards.push({ id: pairId * 2 + 1, ...data })
  })
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

function fmt(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MemoryGame() {
  const { playSound } = useSound()
  const { playerName, updateScore } = usePlayer()

  const [phase, setPhase]       = useState<Phase>('menu')
  const [mode, setMode]         = useState<GameMode>('solo')
  const [difficulty, setDiff]   = useState<Difficulty>('easy')
  const [showHelp, setShowHelp] = useState(false)

  const [cards, setCards]               = useState<CardData[]>([])
  const [selected, setSelected]         = useState<number[]>([])
  const [locked, setLocked]             = useState(false)
  const [currentPlayer, setCurrentP]    = useState<1 | 2>(1)
  const [scores, setScores]             = useState<ScoreState>({ p1: 0, p2: 0 })
  const [elapsed, setElapsed]           = useState(0)
  const [bestTime, setBestTime]         = useState<number | null>(null)
  const [winnerPlayer, setWinner]       = useState<1 | 2 | 'draw' | null>(null)
  const [victimCards, setVictimCards]   = useState<[number,number] | null>(null)
  const [lastLesson, setLastLesson]     = useState<MemoryLesson | null>(null)

  const aiMemory  = useRef<Map<number, number[]>>(new Map())
  const aiTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  // stable refs for callbacks
  const cardsRef        = useRef<CardData[]>([])
  const currentPRef     = useRef<1|2>(1)
  const lockedRef       = useRef(false)
  const scoresRef       = useRef<ScoreState>({ p1: 0, p2: 0 })
  const elapsedRef      = useRef(0)
  const modeRef         = useRef<GameMode>('solo')
  const diffRef         = useRef<Difficulty>('easy')
  const lessonTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { cardsRef.current = cards },       [cards])
  useEffect(() => { currentPRef.current = currentPlayer }, [currentPlayer])
  useEffect(() => { lockedRef.current  = locked },    [locked])
  useEffect(() => { scoresRef.current  = scores },    [scores])
  useEffect(() => { elapsedRef.current = elapsed },   [elapsed])
  useEffect(() => { modeRef.current    = mode },      [mode])
  useEffect(() => { diffRef.current    = difficulty },[difficulty])

  // auto-dismiss Bible lesson popup after 5 seconds
  useEffect(() => {
    if (lessonTimerRef.current) clearTimeout(lessonTimerRef.current)
    if (!lastLesson) return
    lessonTimerRef.current = setTimeout(() => setLastLesson(null), 5000)
    return () => { if (lessonTimerRef.current) clearTimeout(lessonTimerRef.current) }
  }, [lastLesson])

  // load best time
  useEffect(() => {
    const s = localStorage.getItem(LS_BEST(difficulty))
    setBestTime(s ? parseInt(s, 10) : null)
  }, [difficulty])

  // timer
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'solo') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, mode])

  // ── victory helper (stable, uses refs) ────────────────────────────────────
  const triggerVictory = useCallback((finalScores: ScoreState) => {
    if (timerRef.current) clearInterval(timerRef.current)
    playSound('win')
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#6BB8FF','#A78BFA','#ffffff','#FCD34D','#86EFAC'] })
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.4 }, colors: ['#FCA5A5','#FCD34D','#A78BFA'] }), 400)

    const gm = modeRef.current
    const diff = diffRef.current
    if (gm === 'solo') {
      const t = elapsedRef.current
      const stored = localStorage.getItem(LS_BEST(diff))
      if (!stored || t < parseInt(stored, 10)) {
        localStorage.setItem(LS_BEST(diff), t.toString())
        setBestTime(t)
      }
      updateScore('memory', finalScores.p1)
    } else {
      if (finalScores.p1 > finalScores.p2) setWinner(1)
      else if (finalScores.p2 > finalScores.p1) setWinner(2)
      else setWinner('draw')
      updateScore('memory', Math.max(finalScores.p1, finalScores.p2))
    }
    setPhase('victory')
  }, [playSound, updateScore])

  // ── evaluate match (pure logic, uses refs) ────────────────────────────────
  const evaluateMatch = useCallback((id1: number, id2: number) => {
    const prev = cardsRef.current
    const c1 = prev.find(c => c.id === id1)
    const c2 = prev.find(c => c.id === id2)
    if (!c1 || !c2) return

    if (c1.pairId === c2.pairId) {
      playSound('match')
      setLastLesson({ title: c1.title, emoji: c1.emoji, verseRef: c1.verseRef, message: c1.message })
      const newCards = prev.map(c =>
        c.id === id1 || c.id === id2 ? { ...c, isMatched: true, isFlipped: true } : c
      )
      cardsRef.current = newCards
      setCards(newCards)

      const matchedPairs = newCards.filter(c => c.isMatched).length / 2
      const totalPairs   = DIFFICULTY_CONFIG[diffRef.current].pairs
      const player       = currentPRef.current

      setScores(s => {
        const next = player === 1 ? { ...s, p1: s.p1 + 1 } : { ...s, p2: s.p2 + 1 }
        scoresRef.current = next
        if (matchedPairs >= totalPairs) {
          setTimeout(() => triggerVictory(next), 200)
        }
        return next
      })
      setSelected([])
      // player keeps turn on match — no player switch
      if (shouldContinueAiTurn({ mode: modeRef.current, currentPlayer: player, matchedPairs, totalPairs })) {
        lockedRef.current = false
        setLocked(false)
      }
    } else {
      playSound('error')
      lockedRef.current = true
      setLocked(true)
      setTimeout(() => {
        const updated = cardsRef.current.map(c =>
          (c.id === id1 || c.id === id2) && !c.isMatched ? { ...c, isFlipped: false } : c
        )
        cardsRef.current = updated
        setCards(updated)
        setSelected([])
        lockedRef.current = false
        setLocked(false)
        if (modeRef.current !== 'solo') {
          const next: 1|2 = currentPRef.current === 1 ? 2 : 1
          currentPRef.current = next
          setCurrentP(next)
        }
      }, 1000)
    }
  }, [playSound, triggerVictory])

  // ── AI turn ───────────────────────────────────────────────────────────────
  const doAiTurn = useCallback(() => {
    if (lockedRef.current) return
    const deck = cardsRef.current
    const unmatched = deck.filter(c => !c.isMatched && !c.isFlipped)
    if (unmatched.length < 2) return

    let first: CardData | undefined
    let second: CardData | undefined

    // 30% chance to recall a full known pair
    if (Math.random() < 0.30) {
      for (const [pairId, ids] of aiMemory.current.entries()) {
        if (ids.length >= 2) {
          const a = unmatched.find(c => c.id === ids[0])
          const b = unmatched.find(c => c.id === ids[1])
          if (a && b) { first = a; second = b; break }
        }
      }
    }

    if (!first) {
      const pool = [...unmatched].sort(() => Math.random() - 0.5)
      first = pool[0]
      // try to find second via memory
      const knownIds = aiMemory.current.get(first.pairId)
      if (knownIds) {
        const partnerId = knownIds.find(id => id !== first!.id)
        if (partnerId !== undefined) {
          second = unmatched.find(c => c.id === partnerId)
        }
      }
      if (!second) second = pool[1]
    }

    if (!first || !second) return

    // While the computer reveals and evaluates its cards, block new turns.
    // Releasing this lock after a non-final match schedules its extra move.
    lockedRef.current = true
    setLocked(true)

    ;[first, second].forEach(card => {
      const mem = aiMemory.current.get(card.pairId) ?? []
      if (!mem.includes(card.id)) aiMemory.current.set(card.pairId, [...mem, card.id])
    })

    const fId = first.id
    const sId = second.id

    playSound('flip')
    setCards(c => c.map(x => x.id === fId ? { ...x, isFlipped: true } : x))
    cardsRef.current = cardsRef.current.map(x => x.id === fId ? { ...x, isFlipped: true } : x)

    setTimeout(() => {
      playSound('flip')
      setCards(c => c.map(x => x.id === sId ? { ...x, isFlipped: true } : x))
      cardsRef.current = cardsRef.current.map(x => x.id === sId ? { ...x, isFlipped: true } : x)
      setSelected([fId, sId])
      setTimeout(() => evaluateMatch(fId, sId), 400)
    }, 700)
  }, [playSound, evaluateMatch])

  // AI turn trigger
  useEffect(() => {
    if (phase !== 'playing' || mode !== 'ai' || currentPlayer !== 2 || locked) return
    aiTimer.current = setTimeout(doAiTurn, 900)
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current) }
  }, [phase, mode, currentPlayer, locked, doAiTurn])

  // ── start ─────────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    playSound('click')
    if (aiTimer.current)  clearTimeout(aiTimer.current)
    if (timerRef.current) clearInterval(timerRef.current)
    const deck = buildDeck(DIFFICULTY_CONFIG[difficulty].pairs)
    cardsRef.current = deck
    currentPRef.current = 1
    lockedRef.current   = false
    scoresRef.current   = { p1: 0, p2: 0 }
    elapsedRef.current  = 0
    aiMemory.current    = new Map()
    setCards(deck)
    setSelected([])
    setLocked(false)
    setCurrentP(1)
    setScores({ p1: 0, p2: 0 })
    setElapsed(0)
    setWinner(null)
    setVictimCards(null)
    setLastLesson(null)
    const s = localStorage.getItem(LS_BEST(difficulty))
    setBestTime(s ? parseInt(s, 10) : null)
    setPhase('playing')
  }, [difficulty, playSound])

  // ── card click ────────────────────────────────────────────────────────────
  const handleCardClick = useCallback((cardId: number) => {
    if (phase !== 'playing') return
    if (mode === 'ai' && currentPlayer === 2) return
    if (locked) return
    const card = cardsRef.current.find(c => c.id === cardId)
    if (!card || card.isFlipped || card.isMatched) return

    playSound('flip')
    // update AI memory when player flips
    const mem = aiMemory.current.get(card.pairId) ?? []
    if (!mem.includes(card.id)) aiMemory.current.set(card.pairId, [...mem, card.id])

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c))
    cardsRef.current = cardsRef.current.map(c => c.id === cardId ? { ...c, isFlipped: true } : c)

    setSelected(prev => {
      if (prev.length === 0) return [cardId]
      if (prev.length === 1) {
        const pair: [number,number] = [prev[0], cardId]
        setVictimCards(pair)
        setTimeout(() => evaluateMatch(pair[0], pair[1]), 100)
        return pair
      }
      return prev
    })
  }, [phase, mode, currentPlayer, locked, playSound, evaluateMatch])

  const goToMenu = () => {
    playSound('click')
    if (aiTimer.current)  clearTimeout(aiTimer.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('menu')
  }
  const restart = () => {
    if (aiTimer.current)  clearTimeout(aiTimer.current)
    if (timerRef.current) clearInterval(timerRef.current)
    startGame()
  }

  const isAiTurn = mode === 'ai' && currentPlayer === 2
  const { cols, pairs: totalPairs } = DIFFICULTY_CONFIG[difficulty]

  // ─── HELP MODAL (reusable) ────────────────────────────────────────────────
  const HelpModal = () => (
    <AnimatePresence>
      {showHelp && (
        <motion.div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowHelp(false)}
        >
          <motion.div
            className="glass-card p-6 max-w-sm w-full"
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-3 text-center" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>❓ Como Jogar</h2>
            <ul className="space-y-2 text-sm" style={{ color: '#4A5568' }}>
              <li>🃏 <b>Vire duas cartas</b> por vez tentando encontrar pares iguais.</li>
              <li>✅ <b>Par encontrado?</b> As cartas ficam viradas para cima!</li>
              <li>❌ <b>Não combinou?</b> As cartas voltam após 1 segundo.</li>
              <li>🏆 <b>Achou um par?</b> Você joga de novo!</li>
              <li>📖 <b>Descoberta bíblica:</b> cada par revela uma mensagem e sua referência.</li>
              <li>🧍 <b>Solo:</b> Menor tempo possível.</li>
              <li>👥 <b>Dois Jogadores:</b> Quem achar mais pares vence!</li>
              <li>🤖 <b>Vs Computador:</b> O computador tem 30% de chance de lembrar cartas!</li>
            </ul>
            <button className="btn-primary w-full mt-4" style={{ minHeight: 44 }} onClick={() => { playSound('click'); setShowHelp(false) }}>
              Entendido! 👍
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── MENU ─────────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-5">
        <HelpModal />

        <motion.div className="text-center" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="text-6xl mb-2">🕊️</div>
          <h1 className="text-4xl font-bold" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>
            Memória da Bíblia
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Encontre os pares e descubra histórias da fé!</p>
        </motion.div>

        {/* Mode */}
        <motion.div className="glass-card p-5 w-full max-w-md"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { delay: 0.1 } }}>
          <h2 className="font-bold text-center mb-3" style={{ color: '#7B5EA7' }}>Modo de Jogo</h2>
          <div className="flex flex-col gap-2">
            {(Object.keys(MODE_CONFIG) as GameMode[]).map(m => (
              <button key={m}
                className={mode === m ? 'btn-primary' : 'btn-secondary'}
                style={{ minHeight: 48 }}
                onClick={() => { playSound('click'); setMode(m) }}>
                {MODE_CONFIG[m].icon} {MODE_CONFIG[m].label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Difficulty */}
        <motion.div className="glass-card p-5 w-full max-w-md"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}>
          <h2 className="font-bold text-center mb-3" style={{ color: '#7B5EA7' }}>Dificuldade</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => (
              <button key={d}
                className={`w-full sm:flex-1 text-sm ${difficulty === d ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: 48 }}
                onClick={() => { playSound('click'); setDiff(d) }}>
                {DIFFICULTY_CONFIG[d].label}
              </button>
            ))}
          </div>
          {mode === 'solo' && (
            <p className="text-center text-xs mt-3" style={{ color: '#9CA3AF' }}>
              {bestTime !== null ? `🏅 Melhor tempo: ${fmt(bestTime)}` : '🏅 Sem recorde ainda'}
            </p>
          )}
        </motion.div>

        {/* CTA */}
        <motion.div className="flex gap-3 w-full max-w-md"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { delay: 0.3 } }}>
          <button className="btn-secondary" style={{ minHeight: 52 }}
            onClick={() => { playSound('click'); setShowHelp(true) }}>❓ Ajuda</button>
          <button className="btn-primary flex-1" style={{ minHeight: 52, fontSize: '1.1rem' }}
            onClick={startGame}>🎮 Jogar!</button>
        </motion.div>
      </div>
    )
  }

  // ─── PLAYING ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center p-3 gap-3 game-area">
      <HelpModal />

      {/* Victory overlay */}
      <AnimatePresence>
        {phase === 'victory' && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <motion.div
              className="glass-card p-7 max-w-sm w-full text-center"
              initial={{ scale: 0 }} animate={{ scale: 1, transition: { type: 'spring', bounce: 0.45 } }}
            >
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>
                {mode === 'solo'
                  ? 'Parabéns!'
                  : winnerPlayer === 'draw'
                    ? 'Empate!'
                    : winnerPlayer === 1
                      ? `${playerName} venceu!`
                      : mode === 'ai'
                        ? '🤖 Computador venceu!'
                        : 'Jogador 2 venceu!'}
              </h2>
              <p className="text-sm mt-2 px-3" style={{ color: '#4B5563' }}>
                Você encontrou símbolos que lembram o cuidado, o amor e a salvação de Deus.
              </p>

              {mode === 'solo' && (
                <div className="mt-2 space-y-1">
                  <p className="text-xl font-bold" style={{ color: '#6BB8FF' }}>⏱ {fmt(elapsed)}</p>
                  {bestTime !== null && elapsed <= bestTime && (
                    <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>🥇 Novo recorde!</p>
                  )}
                  {bestTime !== null && elapsed > bestTime && (
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>Recorde: {fmt(bestTime)}</p>
                  )}
                </div>
              )}

              {mode !== 'solo' && (
                <div className="flex justify-center gap-8 mt-4">
                  <div>
                    <p className="text-sm font-bold truncate" style={{ color: '#6BB8FF' }}>{playerName}</p>
                    <p className="text-4xl font-black" style={{ color: '#7B5EA7' }}>{scores.p1}</p>
                  </div>
                  <div className="self-center text-gray-300 text-2xl">vs</div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#FF8E53' }}>
                      {mode === 'ai' ? '🤖 Robô' : 'Jogador 2'}
                    </p>
                    <p className="text-4xl font-black" style={{ color: '#7B5EA7' }}>{scores.p2}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button className="btn-secondary flex-1" style={{ minHeight: 48 }} onClick={goToMenu}>🏠 Menu</button>
                <button className="btn-primary flex-1" style={{ minHeight: 48 }} onClick={restart}>🔄 Jogar Novamente</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div className="w-full max-w-2xl">
        <div className="glass-card px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          {/* Player info */}
          <div className="flex items-center gap-2">
            <span className="text-xl">{isAiTurn ? '🤖' : currentPlayer === 1 ? '🧍' : '👥'}</span>
            <div>
              <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>
                {mode === 'solo' ? 'Jogando' : 'Vez de'}
              </p>
              <p className="font-black text-sm leading-tight" style={{ color: currentPlayer === 1 ? '#6BB8FF' : '#FF8E53' }}>
                {currentPlayer === 1
                  ? playerName
                  : mode === 'ai' ? '🤖 Computador' : 'Jogador 2'}
                {isAiTurn && <span className="text-xs ml-1 font-normal animate-pulse text-gray-400">pensando…</span>}
              </p>
            </div>
          </div>

          {/* Score */}
          {mode !== 'solo' ? (
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs font-bold leading-none" style={{ color: '#6BB8FF' }}>{playerName}</p>
                <p className="text-xl font-black leading-tight" style={{ color: '#7B5EA7' }}>{scores.p1}</p>
              </div>
              <span className="text-gray-200 font-bold text-lg">|</span>
              <div className="text-center">
                <p className="text-xs font-bold leading-none" style={{ color: '#FF8E53' }}>{mode === 'ai' ? '🤖' : 'Jog.2'}</p>
                <p className="text-xl font-black leading-tight" style={{ color: '#7B5EA7' }}>{scores.p2}</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Pares</p>
              <p className="text-lg font-black" style={{ color: '#7B5EA7' }}>{scores.p1}/{totalPairs}</p>
            </div>
          )}

          {/* Timer + buttons */}
          <div className="flex items-center gap-1">
            {mode === 'solo' && (
              <div className="text-center mr-1">
                <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Tempo</p>
                <p className="text-base font-black font-mono" style={{ color: '#6BB8FF' }}>{fmt(elapsed)}</p>
              </div>
            )}
            <button className="btn-secondary text-xs px-2" style={{ minHeight: 36, minWidth: 36 }}
              onClick={() => { playSound('click'); setShowHelp(true) }}>❓</button>
            <button className="btn-secondary text-xs px-2" style={{ minHeight: 36, minWidth: 36 }}
              onClick={restart}>🔄</button>
            <button className="btn-secondary text-xs px-2" style={{ minHeight: 36, minWidth: 36 }}
              onClick={goToMenu}>🏠</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        className="w-full max-w-2xl"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}
      >
        {cards.map(card => (
          <MemoryCard
            key={card.id}
            card={card}
            onClick={() => handleCardClick(card.id)}
            disabled={locked || isAiTurn || card.isMatched || card.isFlipped}
          />
        ))}
      </div>


      <AnimatePresence>
        {lastLesson && (
          <motion.div
            key={lastLesson.title}
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="fixed bottom-4 left-3 right-3 z-50 glass-card px-4 py-4 mx-auto"
            style={{ maxWidth: 460, boxShadow: '0 8px 32px rgba(107,184,255,0.25), 0 2px 8px rgba(167,139,250,0.2)' }}
            role="status"
            aria-live="polite"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setLastLesson(null)}
              className="absolute top-2 right-2 flex items-center justify-center rounded-full text-sm font-black"
              style={{ width: 28, height: 28, background: 'rgba(167,139,250,0.15)', color: '#7B5EA7' }}
              aria-label="Fechar mensagem bíblica"
            >✕</button>

            <div className="flex items-start gap-3 pr-6">
              <motion.span
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ repeat: 2, duration: 0.4 }}
                className="text-4xl flex-shrink-0"
                aria-hidden="true"
              >{lastLesson.emoji}</motion.span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider mb-0.5" style={{ color: '#A78BFA' }}>
                  ✨ Par encontrado!
                </p>
                <strong className="block text-sm font-black" style={{ color: '#5B3A8A' }}>
                  {lastLesson.title}
                </strong>
                <p className="text-sm mt-1 leading-snug" style={{ color: '#374151' }}>
                  {lastLesson.message}
                </p>
                <span className="verse-chip mt-2 inline-block">📖 {lastLesson.verseRef}</span>
              </div>
            </div>

            {/* Auto-dismiss progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 5, ease: 'linear' }}
              style={{
                height: 3, borderRadius: 99, marginTop: 10,
                background: 'linear-gradient(90deg,#6BB8FF,#A78BFA)',
                transformOrigin: 'left',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>


      {mode === 'solo' && bestTime !== null && (
        <p className="text-xs pb-2" style={{ color: '#9CA3AF' }}>
          🏅 Recorde {DIFFICULTY_CONFIG[difficulty].label}: {fmt(bestTime)}
        </p>
      )}
    </div>
  )
}

// ─── Card Component ───────────────────────────────────────────────────────────

interface MemoryCardProps {
  card: CardData
  onClick: () => void
  disabled: boolean
}

function MemoryCard({ card, onClick, disabled }: MemoryCardProps) {
  const isUp = card.isFlipped || card.isMatched

  return (
    <button
      type="button"
      className="flip-card"
      style={{ aspectRatio: '3/4', cursor: disabled ? 'default' : 'pointer', minWidth: 0, border: 0, padding: 0, background: 'transparent' }}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      aria-label={isUp ? `${card.title}${card.isMatched ? ', par encontrado' : ''}` : 'Carta bíblica virada para baixo'}
    >
      <div className={`flip-card-inner${isUp ? ' flipped' : ''}`}>
        {/* Front face-down */}
        <div
          className="flip-card-front"
          style={{ background: 'linear-gradient(135deg,#6BB8FF 0%,#A78BFA 100%)', boxShadow: '0 2px 8px rgba(107,184,255,0.3)' }}
        >
          <span style={{ fontSize: 'clamp(1.2rem,4vw,2rem)', userSelect: 'none' }}>🌟</span>
        </div>
        {/* Back face-up */}
        <div
          className="flip-card-back"
          style={{
            background: card.isMatched ? 'linear-gradient(135deg,#D1FAE5,#A7F3D0)' : 'white',
            border: card.isMatched ? '2px solid #6EE7B7' : '2px solid #E5E7EB',
            boxShadow: card.isMatched ? '0 2px 12px rgba(110,231,183,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'background 0.3s',
          }}
        >
          <span className="flex flex-col items-center gap-1 px-1" style={{ userSelect: 'none' }}>
            <span style={{ fontSize: 'clamp(1.6rem,5vw,2.8rem)' }}>{card.emoji}</span>
            <span className="font-black text-center leading-none" style={{ color: '#5B3A8A', fontSize: 'clamp(0.48rem,1.7vw,0.7rem)' }}>{card.title}</span>
          </span>
        </div>
      </div>
    </button>
  )
}
