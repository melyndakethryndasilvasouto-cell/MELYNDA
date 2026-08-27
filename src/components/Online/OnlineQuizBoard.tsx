import { useEffect, useRef, useState } from 'react'
import type { OnlinePlayer } from '../../online/types'
import quizQuestions from '../../data/quizQuestions.json'

interface Props {
  isHost: boolean
  roomStatus: string
  opponent: OnlinePlayer | null
  broadcastGameState: unknown
  guestMove: unknown
  onBroadcastState: (s: unknown) => void
  onBroadcastMove: (m: unknown) => void
  onFinish: (winner: 'host' | 'guest' | 'draw') => Promise<void>
}

interface Question { question: string; options: string[]; correct: number; verseRef: string; explanation: string }
interface GS {
  questions: Question[]
  current: number
  hostScore: number
  guestScore: number
  hostAnswer: number | null
  guestAnswer: number | null
  phase: 'waiting' | 'question' | 'reveal' | 'finished'
  timeLeft: number
  winner: 'host' | 'guest' | 'draw' | null
}

const TOTAL = 8
const SECONDS = 15
const INIT: GS = { questions: [], current: 0, hostScore: 0, guestScore: 0, hostAnswer: null, guestAnswer: null, phase: 'waiting', timeLeft: SECONDS, winner: null }

function pickQuestions(): Question[] {
  const pool = [...(quizQuestions as Question[])]
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
  return pool.slice(0, TOTAL)
}

export default function OnlineQuizBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, onBroadcastState, onBroadcastMove, onFinish }: Props) {
  const [gs, setGs] = useState<GS>(INIT)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initRef = useRef(false)

  const stopTimers = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (revealTimerRef.current) { clearTimeout(revealTimerRef.current); revealTimerRef.current = null }
  }

  // HOST: init
  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initRef.current) return
    initRef.current = true
    const s: GS = { ...INIT, questions: pickQuestions(), phase: 'question', timeLeft: SECONDS }
    setGs(s); onBroadcastState(s)
  }, [isHost, roomStatus, onBroadcastState])

  // HOST: countdown timer
  useEffect(() => {
    if (!isHost || gs.phase !== 'question') return
    stopTimers()
    timerRef.current = setInterval(() => {
      setGs(prev => {
        if (prev.phase !== 'question') { stopTimers(); return prev }
        if (prev.timeLeft <= 1) {
          stopTimers()
          // Time up — reveal answers
          const q = prev.questions[prev.current]
          const hs = prev.hostAnswer === q.correct ? prev.hostScore + 1 : prev.hostScore
          const gs2 = prev.guestAnswer === q.correct ? prev.guestScore + 1 : prev.guestScore
          const isLast = prev.current + 1 >= prev.questions.length
          const next: GS = { ...prev, hostScore: hs, guestScore: gs2, phase: 'reveal', timeLeft: 0, winner: isLast ? (hs > gs2 ? 'host' : gs2 > hs ? 'guest' : 'draw') : null }
          onBroadcastState(next)
          revealTimerRef.current = setTimeout(() => {
            setGs(s2 => {
              if (s2.phase !== 'reveal') return s2
              const nextQ = s2.current + 1
              const fin = nextQ >= s2.questions.length
              const n: GS = { ...s2, current: nextQ, hostAnswer: null, guestAnswer: null, phase: fin ? 'finished' : 'question', timeLeft: SECONDS }
              onBroadcastState(n)
              return n
            })
          }, 3000)
          return next
        }
        const t = { ...prev, timeLeft: prev.timeLeft - 1 }
        onBroadcastState(t)
        return t
      })
    }, 1000)
    return stopTimers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, gs.phase, gs.current])

  // GUEST: apply host state
  useEffect(() => { if (!isHost && broadcastGameState) setGs(broadcastGameState as GS) }, [isHost, broadcastGameState])

  // HOST: apply guest answer
  useEffect(() => {
    if (!isHost || !guestMove) return
    const m = guestMove as { answer?: number }
    if (m.answer == null) return
    setGs(prev => {
      if (prev.phase !== 'question') return prev
      const next = { ...prev, guestAnswer: m.answer ?? null }
      onBroadcastState(next)
      return next
    })
  }, [guestMove, isHost, onBroadcastState])

  useEffect(() => { if (gs.phase === 'finished' && gs.winner) void onFinish(gs.winner) }, [gs.phase, gs.winner, onFinish])
  useEffect(() => () => stopTimers(), [])

  const submitAnswer = (answer: number) => {
    if (gs.phase !== 'question') return
    if (isHost) {
      setGs(prev => { const n = { ...prev, hostAnswer: answer }; onBroadcastState(n); return n })
    } else {
      onBroadcastMove({ answer })
      setGs(prev => ({ ...prev, guestAnswer: answer }))
    }
  }

  const myRole = isHost ? 'host' : 'guest'
  const myAnswer = isHost ? gs.hostAnswer : gs.guestAnswer
  const myScore = isHost ? gs.hostScore : gs.guestScore
  const oppScore = isHost ? gs.guestScore : gs.hostScore
  const q = gs.questions[gs.current]

  if (roomStatus === 'waiting') return <div className="glass-card mt-4 p-6 text-center"><p className="text-3xl">⏳</p><p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Aguardando {opponent?.name ?? 'amigo'} aceitar…</p></div>
  if (roomStatus === 'cancelled' || gs.phase === 'waiting' || !q) return <div className="glass-card mt-4 p-6 text-center"><p className="animate-pulse font-black" style={{ color: '#5B3A8A' }}>{roomStatus === 'cancelled' ? 'Sala encerrada.' : 'Preparando perguntas…'}</p></div>

  if (gs.phase === 'finished') {
    const won = gs.winner === myRole
    return (
      <div className="glass-card mt-4 p-6 text-center">
        <p className="text-5xl">{won ? '🎉' : gs.winner === 'draw' ? '🤝' : '😔'}</p>
        <h2 className="mt-2 font-title text-2xl" style={{ color: '#5B3A8A' }}>{won ? 'Você venceu!' : gs.winner === 'draw' ? 'Empate!' : `${opponent?.name ?? 'Amigo'} venceu!`}</h2>
        <div className="mt-3 flex justify-center gap-8">
          <div><p className="text-xs font-black uppercase" style={{ color: '#4A90D9' }}>Você</p><p className="text-3xl font-black" style={{ color: '#4A90D9' }}>{myScore}</p></div>
          <div><p className="text-xs font-black uppercase" style={{ color: '#7B5EA7' }}>{opponent?.name ?? 'Amigo'}</p><p className="text-3xl font-black" style={{ color: '#7B5EA7' }}>{oppScore}</p></div>
        </div>
      </div>
    )
  }

  const correct = q.correct
  const revealed = gs.phase === 'reveal'

  return (
    <div className="mt-4 space-y-3">
      <div className="glass-card flex items-center justify-between px-4 py-2 text-sm font-black">
        <span style={{ color: '#4A90D9' }}>Você: {myScore}</span>
        <span className={gs.timeLeft <= 5 ? 'text-red-600' : 'text-gray-600'}>{gs.phase === 'question' ? `⏱ ${gs.timeLeft}s` : '📖 Revelando…'}</span>
        <span style={{ color: '#7B5EA7' }}>{opponent?.name ?? 'Amigo'}: {oppScore}</span>
      </div>

      <div className="glass-card p-4">
        <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>Pergunta {gs.current + 1} de {gs.questions.length}</p>
        <p className="font-black text-lg leading-snug" style={{ color: '#1F2937' }}>{q.question}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {q.options.map((opt, i) => {
          const chosen = myAnswer === i
          const isCorrect = i === correct
          let bg = '#F3F4F6'
          let border = '2px solid #E5E7EB'
          if (revealed) {
            if (isCorrect) { bg = '#DCFCE7'; border = '2px solid #86EFAC' }
            else if (chosen) { bg = '#FEE2E2'; border = '2px solid #FCA5A5' }
          } else if (chosen) {
            bg = '#EDE9FE'; border = '2px solid #A78BFA'
          }
          return (
            <button key={i} type="button"
              disabled={myAnswer !== null || gs.phase !== 'question'}
              onClick={() => submitAnswer(i)}
              className="rounded-2xl p-3 text-sm font-black text-left transition-all active:scale-95 disabled:cursor-default"
              style={{ background: bg, border }}
            >
              {['A', 'B', 'C', 'D'][i]}. {opt}
              {revealed && isCorrect && ' ✓'}
              {revealed && chosen && !isCorrect && ' ✗'}
            </button>
          )
        })}
      </div>

      {myAnswer !== null && gs.phase === 'question' && (
        <p className="text-center text-sm font-bold text-gray-500">Resposta registrada! Aguardando {opponent?.name ?? 'amigo'}…</p>
      )}

      {revealed && (
        <div className="glass-card p-3 rounded-2xl text-sm" style={{ background: '#FFF9E8', border: '1px solid #F4D06F' }}>
          <span className="verse-chip mb-1 inline-block">{q.verseRef}</span>
          <p className="font-bold mt-1" style={{ color: '#5B3A8A' }}>{q.explanation}</p>
        </div>
      )}
    </div>
  )
}
