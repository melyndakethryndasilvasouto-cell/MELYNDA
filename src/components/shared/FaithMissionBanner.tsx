import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import missions from '../../data/gameMissions.json'
import { askBibleGuide } from '../../services/bibleGuide'

interface Mission {
  path: string
  icon: string
  theme: string
  verseRef: string
  message: string
  challenge: string
}

export default function FaithMissionBanner() {
  const { pathname } = useLocation()
  const mission = (missions as Mission[]).find(item => item.path === pathname)
  const [guideOpen, setGuideOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const requestAbortRef = useRef<AbortController | null>(null)

  const closeGuide = useCallback((restoreFocus = true) => {
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    setGuideOpen(false)
    setQuestion('')
    setAnswer('')
    setError('')
    setLoading(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useEffect(() => {
    closeGuide(false)
  }, [pathname, closeGuide])

  useEffect(() => {
    if (!guideOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => questionRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeGuide()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [guideOpen, closeGuide])

  useEffect(() => () => requestAbortRef.current?.abort(), [])

  if (!mission) return null

  const askGuide = async (event: FormEvent) => {
    event.preventDefault()
    const cleanQuestion = question.trim()
    if (cleanQuestion.length < 3 || loading) return
    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller
    setLoading(true)
    setAnswer('')
    setError('')
    try {
      const guideAnswer = await askBibleGuide({
        question: cleanQuestion,
        guideMode: 'mission',
        theme: mission.theme,
        verseRef: mission.verseRef,
        message: mission.message,
      }, controller.signal)
      setAnswer(guideAnswer)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      setError(requestError instanceof Error ? requestError.message : 'O Guia Bíblico está indisponível.')
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null
        setLoading(false)
      }
    }
  }

  const guideDialog = guideOpen && createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4"
      data-guide-backdrop="true"
      onMouseDown={event => { if (event.target === event.currentTarget) closeGuide() }}
    >
      <section
        id="bible-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bible-guide-title"
        className="glass-card relative w-full max-w-lg overflow-y-auto p-5 sm:p-6"
        style={{ maxHeight: 'min(88vh, 680px)' }}
      >
        <button
          type="button"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-bold shadow-sm"
          style={{ color: '#5B3A8A' }}
          aria-label="Fechar Guia Bíblico"
          onClick={() => closeGuide()}
        >
          ×
        </button>

        <div className="pr-12">
          <p className="text-2xl" aria-hidden="true">✨📖</p>
          <h2 id="bible-guide-title" className="mt-1 text-xl font-black" style={{ color: '#5B3A8A' }}>
            Guia Bíblico
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#4B5563' }}>
            Pergunte sobre <strong>{mission.theme}</strong> — {mission.verseRef}.
          </p>
        </div>

        <form className="mt-4 space-y-3" onSubmit={askGuide}>
          <label className="block text-sm font-bold" htmlFor="bible-guide-question">
            O que você quer aprender sobre esta mensagem?
          </label>
          <textarea
            ref={questionRef}
            id="bible-guide-question"
            className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
            style={{ minHeight: 86, color: '#374151' }}
            maxLength={400}
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="Ex.: Esta mensagem está na Bíblia?"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary text-sm" style={{ minHeight: 44 }} disabled={loading || question.trim().length < 3}>
              {loading ? 'Pensando…' : 'Perguntar'}
            </button>
            <button type="button" className="btn-secondary text-sm" style={{ minHeight: 44 }} onClick={() => closeGuide()}>
              Fechar
            </button>
          </div>
          <p className="text-xs" style={{ color: '#6B7280' }}>Não escreva nome, endereço ou outros dados pessoais.</p>
          <div aria-live="polite">
            {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm" style={{ color: '#92400E' }}>{error}</p>}
            {answer && (
              <div className="rounded-xl bg-white/80 px-3 py-3 text-sm" style={{ color: '#374151' }}>
                <strong className="block mb-1" style={{ color: '#5B3A8A' }}>Resposta do Guia Bíblico</strong>
                <p className="whitespace-pre-line leading-relaxed">{answer}</p>
                <p className="mt-2 text-xs" style={{ color: '#6B7280' }}>Resposta criada por IA: confira a passagem na Bíblia NTLH com um adulto responsável.</p>
              </div>
            )}
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )

  return (
    <>
      <aside
        className="faith-mission glass-card mb-4 px-4 py-3"
        aria-label={`Missão bíblica: ${mission.theme}`}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">{mission.icon}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="text-sm" style={{ color: '#5B3A8A' }}>{mission.theme}</strong>
              <span className="verse-chip">{mission.verseRef}</span>
            </div>
            <p className="text-sm mt-1 leading-snug" style={{ color: '#374151' }}>{mission.message}</p>
            <p className="text-xs mt-1 leading-snug" style={{ color: '#6B7280' }}>
              <strong>Missão:</strong> {mission.challenge}
            </p>
            <button
              ref={triggerRef}
              type="button"
              className="mt-2 text-xs font-bold underline underline-offset-2"
              style={{ color: '#5B3A8A', minHeight: 36 }}
              aria-expanded={guideOpen}
              aria-controls="bible-guide-dialog"
              onClick={() => setGuideOpen(true)}
            >
              ✨ Perguntar ao Guia Bíblico (IA opcional)
            </button>
          </div>
        </div>
      </aside>
      {guideDialog}
    </>
  )
}
