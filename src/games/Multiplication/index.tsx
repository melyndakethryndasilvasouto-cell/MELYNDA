import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Brain, Check, ChevronRight, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import { usePlayer } from '../../contexts/PlayerContext'
import { useSound } from '../../contexts/SoundContext'
import {
  ALL_FACTS,
  TABLES,
  buildAnswerOptions,
  createMixedSession,
  createTableSession,
  factKey,
  getLesson,
  scheduleReview,
  updateFactProgress,
} from './learningRules.mjs'

interface Fact {
  table: number
  multiplier: number
  isReview?: boolean
}

interface FactProgress {
  attempts: number
  correct: number
  independentCorrect: number
  mastered: boolean
  needsReview: boolean
  lastPracticed: string
}

interface MultiplicationProgress {
  version: 1
  facts: Record<string, FactProgress>
}

type SessionMode = number | 'mixed'
type Phase = 'choose' | 'playing' | 'complete'

const STORAGE_KEY = 'mel-multiplication-progress-v1'

function emptyProgress(): MultiplicationProgress {
  return { version: 1, facts: {} }
}

function loadProgress(): MultiplicationProgress {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!parsed || parsed.version !== 1 || typeof parsed.facts !== 'object' || Array.isArray(parsed.facts)) return emptyProgress()
    const validFacts: Record<string, FactProgress> = {}
    for (const fact of ALL_FACTS as Fact[]) {
      const key = factKey(fact)
      const saved = parsed.facts[key]
      if (!saved || typeof saved !== 'object') continue
      const attempts = Math.max(0, Number.isFinite(saved.attempts) ? Math.floor(saved.attempts) : 0)
      const correct = Math.min(attempts, Math.max(0, Number.isFinite(saved.correct) ? Math.floor(saved.correct) : 0))
      const independentCorrect = Math.min(correct, Math.max(0, Number.isFinite(saved.independentCorrect)
        ? Math.floor(saved.independentCorrect)
        : saved.mastered === true ? 2 : 0))
      const needsReview = saved.needsReview === true || independentCorrect < 2
      validFacts[key] = {
        attempts,
        correct,
        independentCorrect,
        mastered: independentCorrect >= 2 && !needsReview,
        needsReview,
        lastPracticed: typeof saved.lastPracticed === 'string' ? saved.lastPracticed : '',
      }
    }
    return { version: 1, facts: validFacts }
  } catch {
    return emptyProgress()
  }
}

function saveProgress(progress: MultiplicationProgress) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)) } catch {}
}

export default function Multiplication() {
  const { updateScore, addAchievement } = usePlayer()
  const { playSound } = useSound()
  const [progress, setProgress] = useState<MultiplicationProgress>(loadProgress)
  const [phase, setPhase] = useState<Phase>('choose')
  const [mode, setMode] = useState<SessionMode>(2)
  const [queue, setQueue] = useState<Fact[]>([])
  const [feedback, setFeedback] = useState<{ correct: boolean; chosen: number; assisted: boolean; masteredNow: boolean } | null>(null)
  const [hintOpen, setHintOpen] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [round, setRound] = useState(1)
  const questionRef = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const completionRef = useRef<HTMLHeadingElement>(null)

  const current = queue[0]
  const lesson = useMemo(() => current ? getLesson(current) : null, [current])
  const options = useMemo(() => current ? buildAnswerOptions(current) : [], [current])
  const masteredTotal = Object.values(progress.facts).filter(item => item.mastered).length
  const needsReviewTotal = Object.values(progress.facts).filter(item => item.needsReview).length

  useEffect(() => {
    if (phase !== 'playing' || feedback || !current) return
    const frame = window.requestAnimationFrame(() => questionRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [phase, feedback, current])

  useEffect(() => {
    if (!feedback) return
    const frame = window.requestAnimationFrame(() => feedbackRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [feedback])

  useEffect(() => {
    if (phase !== 'complete') return
    const frame = window.requestAnimationFrame(() => completionRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [phase])

  useEffect(() => {
    if (phase !== 'complete' || correctAnswers < attempts || attempts < 10) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.65 }, disableForReducedMotion: true })
  }, [phase, correctAnswers, attempts])

  const tableMastery = (table: number) => (ALL_FACTS as Fact[])
    .filter(fact => fact.table === table && progress.facts[factKey(fact)]?.mastered)
    .length

  const startSession = (selectedMode: SessionMode) => {
    const reviewKeys = Object.entries(progress.facts)
      .filter(([, item]) => item.needsReview)
      .map(([key]) => key)
    const learningKeys = (ALL_FACTS as Fact[])
      .filter(fact => !progress.facts[factKey(fact)]?.mastered && !progress.facts[factKey(fact)]?.needsReview)
      .map(factKey)
    const facts = selectedMode === 'mixed'
      ? createMixedSession(reviewKeys, Math.random, learningKeys)
      : createTableSession(selectedMode)
    setMode(selectedMode)
    setQueue(facts)
    setFeedback(null)
    setHintOpen(false)
    setAttempts(0)
    setCorrectAnswers(0)
    setRound(1)
    setPhase('playing')
    playSound('click')
  }

  const answer = (chosen: number) => {
    if (!current || !lesson || feedback) return
    const correct = chosen === lesson.answer
    const assisted = hintOpen
    const key = factKey(current)
    const factProgress = updateFactProgress(progress.facts[key], { correct, assisted })
    setFeedback({ correct, chosen, assisted, masteredNow: factProgress.mastered })
    setAttempts(value => value + 1)
    if (correct) setCorrectAnswers(value => value + 1)
    playSound(correct ? 'match' : 'error')

    setProgress(previous => {
      const updated = updateFactProgress(previous.facts[key], { correct, assisted })
      const next: MultiplicationProgress = {
        version: 1,
        facts: {
          ...previous.facts,
          [key]: {
            ...updated,
            lastPracticed: new Date().toISOString(),
          },
        },
      }
      saveProgress(next)
      return next
    })

    if (!factProgress.mastered) {
      setQueue(previous => [previous[0], ...scheduleReview(previous.slice(1), current)])
    }
  }

  const finishSession = () => {
    const accuracy = attempts ? Math.round((correctAnswers / attempts) * 100) : 0
    updateScore('tabuada', accuracy)
    addAchievement('tabuada-primeira-missao')
    if (accuracy === 100 && typeof mode === 'number') addAchievement(`tabuada-${mode}-sem-erros`)
    if (masteredTotal === 80) addAchievement('tabuada-todas-dominadas')
    playSound(accuracy >= 70 ? 'win' : 'click')
    setPhase('complete')
  }

  const nextQuestion = () => {
    if (!feedback) return
    if (queue.length <= 1) {
      finishSession()
      return
    }
    setQueue(previous => previous.slice(1))
    setFeedback(null)
    setHintOpen(false)
    setRound(value => value + 1)
    playSound('click')
  }

  if (phase === 'choose') {
    return (
      <div className="game-area pb-6">
        <section className="text-center" aria-labelledby="multiplication-title">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-6xl" aria-hidden="true">🧠</motion.div>
          <h1 id="multiplication-title" className="mt-2 font-title text-3xl leading-tight sm:text-4xl" style={{ color: '#5B3A8A' }}>Tesouros da Tabuada</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed" style={{ color: '#4B5563' }}>
            Diga a resposta em voz alta, escolha uma opção e descubra um truque para guardar a conta na memória.
          </p>
        </section>

        <section className="glass-card mt-5 p-4 sm:p-5" aria-labelledby="choose-table-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="choose-table-title" className="text-lg font-black" style={{ color: '#5B3A8A' }}>Qual tabuada vamos aprender?</h2>
              <p className="mt-1 text-sm" style={{ color: '#4B5563' }}>Cada missão pratica do ×1 ao ×10, sem cronômetro.</p>
            </div>
            <div className="shrink-0 rounded-2xl bg-amber-50 px-3 py-2 text-center" aria-label={`${masteredTotal} de 80 contas dominadas`}>
              <strong className="block text-lg" style={{ color: '#92400E' }}>{masteredTotal}/80</strong>
              <span className="text-xs font-bold" style={{ color: '#78350F' }}>aprendidas</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-table-selector="true">
            {(TABLES as number[]).map(table => {
              const mastered = tableMastery(table)
              return (
                <button
                  key={table}
                  type="button"
                  data-table-choice={table}
                  onClick={() => startSession(table)}
                  className="min-h-20 rounded-2xl border-2 bg-white px-3 py-2 text-center shadow-sm transition-transform active:scale-95"
                  style={{ borderColor: mastered === 10 ? '#34D399' : '#C4B5FD', color: '#4C1D95' }}
                  aria-label={`Praticar tabuada do ${table}, ${mastered} de 10 contas aprendidas`}
                >
                  <strong className="block text-xl">Tabuada do {table}</strong>
                  <span className="mt-1 block text-xs font-bold" style={{ color: mastered === 10 ? '#047857' : '#4B5563' }}>{mastered}/10 aprendidas</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => startSession('mixed')}
            className="btn-primary mt-4 w-full"
            style={{ background: 'linear-gradient(135deg,#059669,#2563EB)' }}
          >
            <Sparkles size={20} aria-hidden="true" /> Misturar tabuadas 2 a 9
          </button>
          {needsReviewTotal > 0 && (
            <p className="mt-2 text-center text-xs font-bold" style={{ color: '#6B7280' }}>
              O treino misto começará por {needsReviewTotal} {needsReviewTotal === 1 ? 'conta que merece' : 'contas que merecem'} revisão.
            </p>
          )}
        </section>

        <details className="glass-card mt-4 p-4">
          <summary className="cursor-pointer text-base font-black" style={{ color: '#5B3A8A' }}>📚 Abrir mapa completo das tabuadas</summary>
          <p className="mt-2 text-sm" style={{ color: '#4B5563' }}>Leia uma linha por vez e procure os padrões.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(TABLES as number[]).map(table => (
              <div key={table} className="rounded-2xl bg-white/80 p-3">
                <h3 className="font-black" style={{ color: '#1D4E89' }}>Tabuada do {table}</h3>
                <p className="mt-1 text-sm leading-7" style={{ color: '#374151' }}>
                  {Array.from({ length: 10 }, (_, index) => `${table} × ${index + 1} = ${table * (index + 1)}`).join('  •  ')}
                </p>
              </div>
            ))}
          </div>
        </details>
      </div>
    )
  }

  if (phase === 'complete') {
    const accuracy = attempts ? Math.round((correctAnswers / attempts) * 100) : 0
    return (
      <section className="game-area text-center" aria-labelledby="session-complete-title">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl" aria-hidden="true">🏆</motion.div>
        <h1 ref={completionRef} id="session-complete-title" tabIndex={-1} className="mt-3 font-title text-3xl" style={{ color: '#5B3A8A' }}>Missão concluída!</h1>
        <p className="mt-2 font-bold" style={{ color: '#4B5563' }}>
          Você acertou {correctAnswers} de {attempts} tentativas. Cada treino fortalece a memória!
        </p>
        <div className="glass-card mx-auto mt-5 max-w-sm p-5">
          <strong className="block text-5xl" style={{ color: '#2563EB' }}>{accuracy}%</strong>
          <span className="mt-1 block text-sm font-bold" style={{ color: '#4B5563' }}>de acertos nesta missão</span>
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm leading-relaxed" style={{ color: '#78350F' }}>
            Deus nos dá sabedoria para aprender com paciência. Continue firme, um passo de cada vez!
          </p>
        </div>
        <div className="mx-auto mt-5 grid max-w-sm gap-3">
          <button type="button" className="btn-primary w-full" onClick={() => startSession(mode)}>
            <RotateCcw size={19} aria-hidden="true" /> Treinar novamente
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => setPhase('choose')}>
            Escolher outra tabuada
          </button>
        </div>
      </section>
    )
  }

  if (!current || !lesson) return null

  const completedBase = typeof mode === 'number' ? tableMastery(mode) : masteredTotal
  return (
    <div className="game-area" data-table={current.table} data-multiplier={current.multiplier}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-secondary min-h-11 px-4 py-2 text-sm" onClick={() => setPhase('choose')}>Trocar tabuada</button>
        <span className="rounded-full bg-white px-3 py-2 text-xs font-black shadow-sm" style={{ color: '#1D4E89' }}>
          {mode === 'mixed' ? 'Mistura 2–9' : `Tabuada do ${mode}`} · {completedBase}/{mode === 'mixed' ? 80 : 10}
        </span>
      </div>

      <section className="glass-card mt-4 overflow-hidden p-4 text-center sm:p-6" aria-labelledby="multiplication-question">
        <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider" style={{ color: current.isReview ? '#047857' : '#6D28D9' }}>
          {current.isReview ? <RotateCcw size={16} aria-hidden="true" /> : <Brain size={16} aria-hidden="true" />}
          {current.isReview ? 'Revisão carinhosa' : `Pergunta ${round}`}
        </div>
        <h1 ref={questionRef} id="multiplication-question" tabIndex={-1} className="mt-3 font-title text-3xl sm:text-4xl" style={{ color: '#5B3A8A' }}>
          Quanto é {current.table} × {current.multiplier}?
        </h1>
        <p className="mt-2 text-sm font-bold" style={{ color: '#4B5563' }}>Pense, diga em voz alta e escolha.</p>

        {!feedback && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3" aria-label="Opções de resposta">
              {options.map(option => (
                <button
                  key={option}
                  type="button"
                  data-answer={option}
                  onClick={() => answer(option)}
                  className="min-h-16 rounded-2xl border-2 border-blue-200 bg-white text-2xl font-black shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95"
                  style={{ color: '#1D4E89' }}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-black"
              style={{ color: '#78350F' }}
              aria-expanded={hintOpen}
              onClick={() => { setHintOpen(value => !value); playSound('click') }}
            >
              <Lightbulb size={18} aria-hidden="true" /> Preciso de uma pista
            </button>
            {hintOpen && (
              <p className="mx-auto mt-3 max-w-md rounded-2xl bg-amber-50 p-3 text-sm leading-relaxed" style={{ color: '#78350F' }}>
                {lesson.tip}
              </p>
            )}
          </>
        )}

        {feedback && (
          <motion.div
            ref={feedbackRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-left"
            role="status"
            aria-live="polite"
            data-feedback={feedback.correct ? 'correct' : 'incorrect'}
          >
            <div className="rounded-3xl p-4 sm:p-5" style={{ background: feedback.correct ? '#ECFDF5' : '#FFF7ED', color: feedback.correct ? '#065F46' : '#9A3412' }}>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white" aria-hidden="true">
                  {feedback.correct ? <Check size={24} /> : <Lightbulb size={23} />}
                </span>
                <div>
                  <strong className="block text-lg">{feedback.correct ? (feedback.assisted ? 'Boa! A pista ajudou você.' : 'Muito bem! Você encontrou.') : 'Quase! Vamos descobrir juntos.'}</strong>
                  {!feedback.correct && <span className="text-sm font-bold">Você escolheu {feedback.chosen}; a resposta é {lesson.answer}.</span>}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/80 p-4" style={{ color: '#374151' }}>
                <strong className="block text-2xl" style={{ color: '#5B3A8A' }}>{lesson.equation}</strong>
                <p className="mt-2 text-sm leading-relaxed"><strong>Entenda:</strong> {lesson.explanation}</p>
                <p className="mt-2 text-sm leading-relaxed"><strong>Truque para lembrar:</strong> {lesson.tip}</p>
                <p className="mt-2 text-sm font-bold" style={{ color: '#1D4E89' }}>Repita em voz alta: “{lesson.equation}”.</p>
              </div>

              {!feedback.masteredNow && !current.isReview && (
                <p className="mt-3 text-sm font-bold">Essa conta voltará depois de duas perguntas para você fortalecer a memória sem depender da pista.</p>
              )}
              {!feedback.masteredNow && current.isReview && (
                <p className="mt-3 text-sm font-bold">Tudo bem precisar de mais treino. Ela ficará marcada para a próxima missão.</p>
              )}
            </div>
            <button type="button" className="btn-primary mt-4 w-full" onClick={nextQuestion}>
              {queue.length <= 1 ? 'Ver meu resultado' : 'Próxima pergunta'} <ChevronRight size={20} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </section>
    </div>
  )
}
