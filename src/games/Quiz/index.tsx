import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'
import quizQuestions from '../../data/quizQuestions.json'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  question: string
  options: [string, string, string, string]
  correct: number
  category: string
  verseRef: string
  verseText: string
  explanation: string
}

type GameMode = 'solo' | 'duo'
type Screen = 'mode' | 'local-setup' | 'game' | 'result'

const ALL_QUESTIONS = quizQuestions as Question[]

const QUESTIONS_PER_GAME = 10
const TIMER_SECONDS = 20
const READING_SECONDS = 30
const OPTION_LABELS = ['A', 'B', 'C', 'D']

const CATEGORY_COLORS: Record<string, string> = {
  Criação: '#34D399',
  Histórias: '#FB923C',
  Jesus: '#A78BFA',
  'Vida Cristã': '#60A5FA',
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fireConfetti() {
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#6BB8FF', '#A78BFA', '#ffffff', '#FCD34D', '#34D399'] })
  setTimeout(() => {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.4, x: 0.2 }, colors: ['#6BB8FF', '#A78BFA', '#FCD34D'] })
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.4, x: 0.8 }, colors: ['#6BB8FF', '#A78BFA', '#FCD34D'] })
  }, 400)
}

export default function Quiz() {
  const { playSound } = useSound()
  const { playerName, updateScore } = usePlayer()

  const [screen, setScreen] = useState<Screen>('mode')
  const [mode, setMode] = useState<GameMode>('solo')
  const [showHelp, setShowHelp] = useState(false)
  const [player2Name, setPlayer2Name] = useState('Jogador 2')

  const [questions, setQuestions] = useState<Question[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1)
  const [scores, setScores] = useState<[number, number]>([0, 0])
  const [correctCounts, setCorrectCounts] = useState<[number, number]>([0, 0])
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const [readingTimeLeft, setReadingTimeLeft] = useState(READING_SECONDS)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (nextRef.current) clearTimeout(nextRef.current)
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const startGame = (m: GameMode) => {
    playSound('click')
    setMode(m)
    setQuestions(shuffle(ALL_QUESTIONS).slice(0, QUESTIONS_PER_GAME))
    setQIndex(0)
    setCurrentPlayer(1)
    setScores([0, 0])
    setCorrectCounts([0, 0])
    setSelected(null)
    setAnswered(false)
    setFeedback(null)
    setTimeLeft(TIMER_SECONDS)
    setScreen('game')
  }

  const advanceQuestion = useCallback(() => {
    if (readingTimerRef.current) { clearInterval(readingTimerRef.current); readingTimerRef.current = null }
    setQIndex(prev => {
      const next = prev + 1
      if (next >= QUESTIONS_PER_GAME) {
        setScreen('result')
        return prev
      }
      if (mode === 'duo') setCurrentPlayer(p => p === 1 ? 2 : 1)
      setSelected(null)
      setAnswered(false)
      setFeedback(null)
      setTimeLeft(TIMER_SECONDS)
      setReadingTimeLeft(READING_SECONDS)
      return next
    })
  }, [mode])

  const startReadingTimer = useCallback(() => {
    setReadingTimeLeft(READING_SECONDS)
    if (readingTimerRef.current) clearInterval(readingTimerRef.current)
    readingTimerRef.current = setInterval(() => {
      setReadingTimeLeft(t => {
        if (t <= 1) {
          clearInterval(readingTimerRef.current!)
          readingTimerRef.current = null
          advanceQuestion()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, [advanceQuestion])

  const handleTimeout = useCallback(() => {
    playSound('error')
    setAnswered(true)
    setFeedback('timeout')
    startReadingTimer()
  }, [playSound, startReadingTimer])

  useEffect(() => {
    if (screen !== 'game' || answered) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen, qIndex, answered, handleTimeout])

  const handleAnswer = (idx: number) => {
    if (answered) return
    clearTimers()
    playSound('click')
    setSelected(idx)
    setAnswered(true)
    const q = questions[qIndex]
    if (idx === q.correct) {
      playSound('match')
      setFeedback('correct')
      const pIdx = currentPlayer - 1
      setScores(s => { const n = [...s] as [number, number]; n[pIdx] += 10; return n })
      setCorrectCounts(c => { const n = [...c] as [number, number]; n[pIdx]++; return n })
    } else {
      playSound('error')
      setFeedback('wrong')
    }
    startReadingTimer()
  }

  useEffect(() => {
    if (screen !== 'result') return
    clearTimers()
    const bestScore = mode === 'solo' ? scores[0] : Math.max(scores[0], scores[1])
    const saved = parseInt(localStorage.getItem('quiz_best') || '0', 10)
    if (bestScore > saved) localStorage.setItem('quiz_best', String(bestScore))
    updateScore('Quiz', bestScore)
    const totalCorrect = correctCounts[0] + (mode === 'duo' ? correctCounts[1] : 0)
    if (totalCorrect >= 7) {
      playSound('win')
      fireConfetti()
    }
  }, [screen])

  const restart = () => {
    playSound('click')
    clearTimers()
    setScreen('mode')
  }

  const currentQ = questions[qIndex]
  const timerPercent = (timeLeft / TIMER_SECONDS) * 100
  const timerRed = timeLeft < 5
  const bestScore = parseInt(localStorage.getItem('quiz_best') || '0', 10)

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-6 game-area">
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <h1 className="text-3xl" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>
          📖 Quiz da Bíblia
        </h1>
        <button
          className="btn-secondary px-4 py-2 text-sm"
          style={{ minHeight: 44 }}
          onClick={() => { playSound('click'); setShowHelp(true) }}
        >
          ❓ Ajuda
        </button>
      </div>

      <AnimatePresence mode="wait">
        {screen === 'mode' && (
          <motion.div
            key="mode"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="glass-card p-8 w-full max-w-md text-center"
          >
            <div className="text-5xl mb-3">📜</div>
            <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>
              Aprender brincando
            </h2>
            {bestScore > 0 && (
              <p className="text-sm mb-4" style={{ color: '#A78BFA' }}>
                 🏆 Melhor pontuação: <strong>{bestScore} pts</strong>
              </p>
            )}
            
            <div className="flex flex-col gap-3 mt-4">
              <button className="btn-primary py-4 text-lg" style={{ minHeight: 56 }} onClick={() => startGame('solo')}>
                🧍‍♀️ Jogar sozinha
              </button>

              <button className="btn-secondary py-4 text-lg shadow-sm" style={{ minHeight: 56, background: '#EFF6FF', borderColor: '#BFDBFE', color: '#2563EB' }} onClick={() => window.location.href = '/online'}>
                🌐 Jogar com Amigo Online
              </button>

              <button className="btn-secondary py-4 text-lg" style={{ minHeight: 56 }} onClick={() => setScreen('local-setup')}>
                📱 Passar o Celular (Local)
              </button>
            </div>
          </motion.div>
        )}

        {screen === 'local-setup' && (
          <motion.div
            key="local-setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-card p-8 w-full max-w-md text-center"
          >
             <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>
              Modo Local
            </h2>
            <p className="text-sm mb-5 text-gray-500">
              Jogue com alguém do seu lado. Vocês vão se revezar para responder!
            </p>
            <label className="block text-sm font-bold mb-4 text-left" style={{ color: '#4B5563' }}>
              Nome do Jogador 2:
              <input
                value={player2Name}
                onChange={e => setPlayer2Name(e.target.value.slice(0, 16) || '')}
                maxLength={16}
                placeholder="Ex: João"
                className="mt-2 w-full rounded-2xl border border-purple-200 px-4 py-3 text-base font-bold outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
                style={{ fontFamily: "'Nunito'" }}
              />
            </label>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1 py-3" onClick={() => setScreen('mode')}>
                Voltar
              </button>
              <button className="btn-primary flex-1 py-3" onClick={() => {
                if(!player2Name.trim()) setPlayer2Name('Jogador 2')
                startGame('duo')
              }}>
                Começar
              </button>
            </div>
          </motion.div>
        )}

        {screen === 'game' && currentQ && (
          <motion.div
            key={`game-${qIndex}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl flex flex-col gap-4"
          >
            <div className="glass-card px-5 py-3 flex items-center justify-between">
              <div className="flex gap-4 text-sm font-bold" style={{ color: '#4A90D9' }}>
                <span>{playerName}: {scores[0]} pts</span>
                {mode === 'duo' && <span>{player2Name}: {scores[1]} pts</span>}
              </div>
              <span className="text-sm font-semibold" style={{ color: '#7B5EA7' }}>
                {qIndex + 1}/{QUESTIONS_PER_GAME}
              </span>
            </div>

            {mode === 'duo' && (
              <motion.div
                key={currentPlayer}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center text-sm font-bold py-2 rounded-2xl"
                style={{ background: currentPlayer === 1 ? '#6BB8FF33' : '#A78BFA33', color: currentPlayer === 1 ? '#4A90D9' : '#7B5EA7' }}
              >
                🎮 Vez de: {currentPlayer === 1 ? playerName : player2Name}
              </motion.div>
            )}

            <div className="w-full rounded-full overflow-hidden" style={{ height: 10, background: '#e5e7eb' }}>
              <motion.div
                animate={{ width: `${timerPercent}%` }}
                transition={{ duration: 0.4 }}
                style={{ height: '100%', borderRadius: 9999, background: timerRed ? '#EF4444' : '#6BB8FF' }}
              />
            </div>
            <div className="text-right text-xs font-bold" style={{ color: timerRed ? '#EF4444' : '#4A90D9', marginTop: -12 }}>
              ⏱ {timeLeft}s
            </div>

            <div className="glass-card px-6 py-5">
              <span
                className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3"
                style={{ background: (CATEGORY_COLORS[currentQ.category] ?? '#A78BFA') + '33', color: CATEGORY_COLORS[currentQ.category] ?? '#A78BFA' }}
              >
                {currentQ.category}
              </span>
              <p className="text-xl font-bold leading-snug" style={{ fontFamily: "'Nunito'", color: '#1e293b' }}>
                {currentQ.question}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {currentQ.options.map((opt, i) => {
                let bg = 'white'
                let border = '#A78BFA'
                let textColor = '#7B5EA7'
                if (answered) {
                  if (i === currentQ.correct) { bg = '#D1FAE5'; border = '#34D399'; textColor = '#065F46' }
                  else if (i === selected && selected !== currentQ.correct) { bg = '#FEE2E2'; border = '#EF4444'; textColor = '#991B1B' }
                  else { border = '#e5e7eb'; textColor = '#94a3b8' }
                }
                return (
                  <motion.button
                    key={i}
                    whileTap={!answered ? { scale: 0.96 } : {}}
                    onClick={() => handleAnswer(i)}
                    disabled={answered}
                    className="flex items-center gap-3 w-full text-left px-5 py-4 rounded-2xl border-2 font-bold transition-colors duration-200"
                    style={{ minHeight: 56, background: bg, borderColor: border, color: textColor, fontFamily: "'Nunito'" }}
                  >
                    <span
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: border + '44', color: textColor }}
                    >
                      {OPTION_LABELS[i]}
                    </span>
                    {opt}
                  </motion.button>
                )
              })}
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-3xl overflow-hidden"
                  role="status"
                  aria-live="polite"
                  style={{
                    background: feedback === 'correct' ? '#D1FAE5' : '#FFF3CD',
                    border: `2px solid ${feedback === 'correct' ? '#34D399' : '#F59E0B'}`,
                  }}
                >
                  {/* Status header */}
                  <div className="px-5 pt-4 pb-2">
                    <p className="font-black text-lg text-center">
                      {feedback === 'correct' && '✅ Correto! +10 pontos'}
                      {feedback === 'wrong' && `💡 A resposta certa é: ${currentQ.options[currentQ.correct]}`}
                      {feedback === 'timeout' && `⏰ Tempo! A resposta é: ${currentQ.options[currentQ.correct]}`}
                    </p>
                    <p className="text-sm mt-1 text-center leading-snug" style={{ color: '#374151' }}>
                      {currentQ.explanation}
                    </p>
                  </div>

                  {/* Full verse text */}
                  <div className="mx-4 mb-3 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.7)' }}>
                    <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: '#7B5EA7' }}>
                      📖 {currentQ.verseRef}
                    </p>
                    <p className="text-base font-bold leading-relaxed italic" style={{ color: '#1F2937', fontFamily: "'Nunito'" }}>
                      "{currentQ.verseText}"
                    </p>
                  </div>

                  {/* 30s countdown + Continue button */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{ color: '#6B7280' }}>
                        Próxima em {readingTimeLeft}s
                      </span>
                      <button
                        type="button"
                        onClick={advanceQuestion}
                        className="rounded-2xl px-4 py-2 text-sm font-black transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg,#7B5EA7,#4A90D9)', color: '#fff', minHeight: 44 }}
                      >
                        Continuar →
                      </button>
                    </div>
                    {/* Progress bar counting down */}
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.12)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: '#7B5EA7' }}
                        initial={{ width: '100%' }}
                        animate={{ width: `${(readingTimeLeft / READING_SECONDS) * 100}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button className="btn-secondary py-2 text-sm self-center px-6" style={{ minHeight: 44 }} onClick={restart}>
              🔄 Recomeçar
            </button>
          </motion.div>
        )}

        {screen === 'result' && (
          <motion.div
            key="result"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="glass-card p-8 w-full max-w-md text-center"
          >
            <div className="text-5xl mb-2">🏆</div>
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>
              Tesouros guardados!
            </h2>
            {mode === 'solo' ? (
              <>
                <p className="text-4xl font-bold mb-1" style={{ color: '#4A90D9' }}>{scores[0]} pts</p>
                <p className="text-sm mb-2" style={{ color: '#64748b' }}>{correctCounts[0]} de {QUESTIONS_PER_GAME} corretas</p>
                <p className="text-sm mb-4" style={{ color: '#A78BFA' }}>
                  🏅 Melhor: {Math.max(scores[0], bestScore)} pts
                </p>
                {correctCounts[0] >= 9 && <p className="text-green-600 font-bold mb-3">🌟 Incrivel! Quase perfeito!</p>}
                {correctCounts[0] >= 7 && correctCounts[0] < 9 && <p className="text-blue-600 font-bold mb-3">😊 Muito bem!</p>}
                {correctCounts[0] < 7 && <p className="text-orange-500 font-bold mb-3">📚 Continue praticando!</p>}
              </>
            ) : (
              <>
                <div className="flex gap-4 mb-4">
                  {([0, 1] as const).map(i => (
                    <div key={i} className="flex-1 rounded-2xl py-4 px-3" style={{ background: i === 0 ? '#6BB8FF22' : '#A78BFA22' }}>
                      <p className="font-bold text-sm mb-1" style={{ color: i === 0 ? '#4A90D9' : '#7B5EA7' }}>
                        {i === 0 ? playerName : player2Name}
                      </p>
                      <p className="text-3xl font-bold" style={{ color: i === 0 ? '#4A90D9' : '#7B5EA7' }}>{scores[i]}</p>
                      <p className="text-xs" style={{ color: '#64748b' }}>{correctCounts[i]} corretas</p>
                    </div>
                  ))}
                </div>
                {scores[0] === scores[1]
                  ? <p className="text-lg font-bold mb-3" style={{ color: '#A78BFA' }}>🤝 Empate!</p>
                  : <p className="text-lg font-bold mb-3" style={{ color: '#34D399' }}>🎉 Vencedor: {scores[0] > scores[1] ? playerName : player2Name}!</p>
                }
              </>
            )}
            <div className="flex gap-3 mt-4">
              <button className="btn-primary flex-1 py-3" style={{ minHeight: 48 }} onClick={restart}>
                🔄 Jogar Novamente
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="glass-card p-7 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-3" style={{ fontFamily: "'Fredoka One'", color: '#7B5EA7' }}>
                ❓ Como Jogar
              </h3>
              <ul className="text-sm space-y-2" style={{ color: '#334155', fontFamily: "'Nunito'" }}>
                 <li>🎯 Responda <strong>10 perguntas bíblicas</strong> de diversas categorias.</li>
                 <li>⏱ Você tem <strong>20 segundos</strong> para cada resposta.</li>
                 <li>✅ Resposta certa vale <strong>10 pontos</strong>.</li>
                 <li>❌ Resposta errada ou tempo esgotado = <strong>0 pontos</strong>.</li>
                 <li>📖 Depois de responder, leia a explicação e confira a referência bíblica.</li>
                <li>👥 No modo dois jogadores, os turnos se alternam a cada pergunta.</li>
                <li>🏆 Ao final, o maior pontuador vence!</li>
                 <li>🎉 Confetes se você acertar 7 ou mais perguntas!</li>
              </ul>
              <button
                className="btn-primary w-full mt-5 py-3"
                style={{ minHeight: 48 }}
                onClick={() => { playSound('click'); setShowHelp(false) }}
              >
                Entendi! 📖
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
