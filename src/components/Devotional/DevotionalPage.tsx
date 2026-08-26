import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BookHeart, MessageCircleQuestion, Sparkles, Trash2 } from 'lucide-react'
import { usePlayer } from '../../contexts/PlayerContext'
import { askBibleGuide } from '../../services/bibleGuide'

interface DevotionalEntry {
  id: string
  question: string
  answer: string
}

const MAX_HISTORY = 12
const quickQuestions = [
  'Quem é Jesus e por que Ele me ama?',
  'Como posso falar com Deus em oração?',
  'O que a Bíblia ensina quando estou com medo?',
  'Como posso perdoar alguém?',
]

function historyKey(playerName: string) {
  return `mel-devotional-history-v1:${encodeURIComponent(playerName.trim().toLocaleLowerCase('pt-BR'))}`
}

function loadHistory(key: string): DevotionalEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(item => (
      item && typeof item.id === 'string' && typeof item.question === 'string' && typeof item.answer === 'string'
    )).slice(-MAX_HISTORY)
  } catch {
    return []
  }
}

export default function DevotionalPage() {
  const { playerName, playerAvatar } = usePlayer()
  const storageKey = useMemo(() => historyKey(playerName), [playerName])
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<DevotionalEntry[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const requestAbortRef = useRef<AbortController | null>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setHistory(loadHistory(storageKey))
  }, [storageKey])

  useEffect(() => () => requestAbortRef.current?.abort(), [])

  const saveHistory = (entries: DevotionalEntry[]) => {
    const limited = entries.slice(-MAX_HISTORY)
    setHistory(limited)
    try { localStorage.setItem(storageKey, JSON.stringify(limited)) } catch {}
  }

  const askQuestion = async (event: FormEvent) => {
    event.preventDefault()
    const cleanQuestion = question.trim()
    if (cleanQuestion.length < 3 || loading) return

    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller
    setLoading(true)
    setError('')
    try {
      const answer = await askBibleGuide({
        question: cleanQuestion,
        guideMode: 'devotional',
      }, controller.signal)
      const entry: DevotionalEntry = {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${history.length}`,
        question: cleanQuestion,
        answer,
      }
      saveHistory([...history, entry])
      setQuestion('')
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      setError(requestError instanceof Error ? requestError.message : 'O Devocional está indisponível agora.')
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null
        setLoading(false)
      }
    }
  }

  const chooseQuickQuestion = (suggestion: string) => {
    setQuestion(suggestion)
    setError('')
    window.requestAnimationFrame(() => questionRef.current?.focus())
  }

  const clearHistory = () => {
    if (!history.length || !window.confirm('Apagar as respostas salvas deste devocional?')) return
    localStorage.removeItem(storageKey)
    setHistory([])
  }

  return (
    <article className="pt-4 pb-6">
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-5"
      >
        <div className="text-5xl" aria-hidden="true">{playerAvatar}</div>
        <p className="mt-2 text-xs font-black uppercase tracking-widest" style={{ color: '#B7791F' }}>Um momento com Jesus</p>
        <h1 className="font-title text-3xl mt-1" style={{ color: '#5B3A8A' }}>Devocional de {playerName}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed" style={{ color: '#4A90D9' }}>
          Tire dúvidas sobre a Bíblia e aprenda a viver cada dia com fé, amor e esperança.
        </p>
      </motion.header>

      <section className="glass-card p-4 sm:p-5" aria-labelledby="devotional-question-title">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg,#FFF7D6,#FDE68A)', color: '#8A5A00' }}>
            <BookHeart size={24} aria-hidden="true" />
          </div>
          <div>
            <h2 id="devotional-question-title" className="font-black" style={{ color: '#5B3A8A' }}>O que você quer aprender hoje?</h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6B7280' }}>
              A IA responde em linguagem infantil, com foco em Jesus e a NTLH como referência. Confira a passagem com um adulto responsável.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Perguntas sugeridas">
          {quickQuestions.map(suggestion => (
            <button
              key={suggestion}
              type="button"
              className="rounded-2xl border border-purple-200 bg-white/80 px-3 py-2 text-left text-xs font-bold transition-transform active:scale-95"
              style={{ color: '#5B3A8A', minHeight: 44 }}
              onClick={() => chooseQuickQuestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form className="mt-4 space-y-3" onSubmit={askQuestion}>
          <label className="block text-sm font-bold" htmlFor="devotional-question">Minha pergunta</label>
          <textarea
            ref={questionRef}
            id="devotional-question"
            className="w-full rounded-2xl border border-purple-200 bg-white px-3 py-3 text-sm"
            style={{ minHeight: 108, color: '#374151' }}
            maxLength={400}
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="Ex.: Como posso confiar em Deus quando estou preocupado?"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs" style={{ color: '#6B7280' }}>{question.length}/400</span>
            <button type="submit" className="btn-primary text-sm" style={{ minHeight: 44 }} disabled={loading || question.trim().length < 3}>
              <Sparkles size={18} aria-hidden="true" />
              {loading ? 'Preparando com carinho…' : 'Perguntar à IA cristã'}
            </button>
          </div>
          <p className="text-xs" style={{ color: '#6B7280' }}>Não escreva nome completo, endereço, escola, telefone ou outros dados pessoais.</p>
          <div aria-live="polite" aria-atomic="true">
            {loading && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm" style={{ color: '#1D4ED8' }}>Estou preparando uma resposta bíblica para você…</p>}
            {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm" style={{ color: '#92400E' }}>{error}</p>}
          </div>
        </form>
      </section>

      <section className="mt-5" aria-labelledby="devotional-history-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="devotional-history-title" className="flex items-center gap-2 font-black" style={{ color: '#5B3A8A' }}>
            <MessageCircleQuestion size={20} aria-hidden="true" />
            Meu devocional
          </h2>
          {history.length > 0 && (
            <button
              type="button"
              className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold"
              style={{ color: '#92400E', background: '#FFF7ED' }}
              onClick={clearHistory}
            >
              <Trash2 size={15} aria-hidden="true" /> Limpar
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="glass-card p-5 text-center">
            <p className="text-3xl" aria-hidden="true">🌱</p>
            <p className="mt-2 text-sm font-bold" style={{ color: '#5B3A8A' }}>Sua primeira descoberta bíblica aparecerá aqui.</p>
            <p className="mt-1 text-xs" style={{ color: '#6B7280' }}>As respostas ficam salvas somente neste navegador.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...history].reverse().map(entry => (
              <article key={entry.id} className="glass-card p-4">
                <h3 className="text-sm font-black" style={{ color: '#4A90D9' }}>Você perguntou</h3>
                <p className="mt-1 text-sm font-bold" style={{ color: '#374151' }}>{entry.question}</p>
                <div className="my-3 h-px bg-purple-100" />
                <h3 className="text-sm font-black" style={{ color: '#5B3A8A' }}>Resposta do Devocional</h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" style={{ color: '#374151' }}>{entry.answer}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}
