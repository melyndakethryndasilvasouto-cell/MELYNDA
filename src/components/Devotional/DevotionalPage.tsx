import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookHeart,
  Check,
  FileText,
  MessageCircleQuestion,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { usePlayer } from '../../contexts/PlayerContext'
import { askBibleGuide } from '../../services/bibleGuide'
import {
  contextualSuggestions,
  conversationDateLabel,
  createConversation,
  DevotionalConversation,
  DevotionalMessage,
  DevotionalStore,
  getDevotionalStorageKey,
  loadDevotionalStore,
  makeId,
  saveDevotionalStore,
} from './devotionalData'

const MAX_QUESTION_CHARS = 1_000

function shortTitle(question: string) {
  const clean = question.trim().replace(/\s+/g, ' ')
  return clean.length <= 48 ? clean : `${clean.slice(0, 45).trim()}…`
}

function messageTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function updateConversation(store: DevotionalStore, id: string, change: (conversation: DevotionalConversation) => DevotionalConversation) {
  return { ...store, conversations: store.conversations.map(item => item.id === id ? change(item) : item) }
}

export default function DevotionalPage() {
  const { playerName, playerAvatar } = usePlayer()
  const [storageKey] = useState(() => getDevotionalStorageKey(playerName))
  const [store, setStore] = useState(() => loadDevotionalStore(storageKey, playerName))
  const storeRef = useRef(store)
  const [question, setQuestion] = useState('')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<'recent' | 'name'>('recent')
  const [panel, setPanel] = useState<'chat' | 'notes'>('chat')
  const [mobileView, setMobileView] = useState<'chat' | 'history'>('chat')
  const [mobileLayout, setMobileLayout] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved')
  const [loadingConversationId, setLoadingConversationId] = useState('')
  const requestAbortRef = useRef<AbortController | null>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)
  const messageLogRef = useRef<HTMLDivElement>(null)
  const historyTriggerRef = useRef<HTMLButtonElement>(null)
  const historyCloseRef = useRef<HTMLButtonElement>(null)
  const activeTitleRef = useRef<HTMLHeadingElement>(null)
  const chatTabRef = useRef<HTMLButtonElement>(null)
  const notesTabRef = useRef<HTMLButtonElement>(null)
  storeRef.current = store

  const activeConversation = store.conversations.find(item => item.id === store.activeConversationId) || store.conversations[0]
  const suggestions = useMemo(
    () => contextualSuggestions(question, activeConversation?.messages || []),
    [question, activeConversation?.messages],
  )

  const visibleConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const filtered = store.conversations.filter(item => !query || item.title.toLocaleLowerCase('pt-BR').includes(query))
    return [...filtered].sort((a, b) => sortMode === 'name'
      ? a.title.localeCompare(b.title, 'pt-BR')
      : b.updatedAt.localeCompare(a.updatedAt))
  }, [search, sortMode, store.conversations])

  useEffect(() => () => requestAbortRef.current?.abort(), [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const updateLayout = () => {
      setMobileLayout(media.matches)
      if (!media.matches) setMobileView('chat')
    }
    updateLayout()
    media.addEventListener('change', updateLayout)
    return () => media.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    if (!mobileLayout || mobileView !== 'history') return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => historyCloseRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileView('chat')
        window.requestAnimationFrame(() => historyTriggerRef.current?.focus())
        return
      }
      if (event.key !== 'Tab') return
      const drawer = historyCloseRef.current?.closest('[role="dialog"]')
      const focusable = drawer ? [...drawer.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')] : []
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileLayout, mobileView])

  useEffect(() => () => {
    saveDevotionalStore(storageKey, storeRef.current)
  }, [storageKey])

  useEffect(() => {
    setSaveStatus('saving')
    const timeout = window.setTimeout(() => {
      setSaveStatus(saveDevotionalStore(storageKey, store) ? 'saved' : 'error')
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [storageKey, store])

  useEffect(() => {
    if (panel !== 'chat') return
    const log = messageLogRef.current
    if (!log) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    log.scrollTo({ top: log.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [activeConversation?.messages.length, panel])

  const closeHistory = (restoreFocus = true) => {
    setMobileView('chat')
    if (restoreFocus) window.requestAnimationFrame(() => historyTriggerRef.current?.focus())
  }

  const selectConversation = (id: string) => {
    setStore(current => ({ ...current, activeConversationId: id }))
    setQuestion('')
    setError('')
    setPanel('chat')
    setMobileView('chat')
    if (mobileLayout) window.requestAnimationFrame(() => activeTitleRef.current?.focus())
  }

  const addConversation = () => {
    const conversation = createConversation()
    setStore(current => ({
      ...current,
      conversations: [conversation, ...current.conversations],
      activeConversationId: conversation.id,
    }))
    setPanel('chat')
    setMobileView('chat')
    setQuestion('')
    setError('')
    window.requestAnimationFrame(() => questionRef.current?.focus())
  }

  const renameConversation = () => {
    if (!activeConversation) return
    const title = window.prompt('Nome desta conversa:', activeConversation.title)?.trim()
    if (!title) return
    setStore(current => updateConversation(current, activeConversation.id, item => ({ ...item, title: title.slice(0, 60), updatedAt: new Date().toISOString() })))
  }

  const deleteConversation = () => {
    if (!activeConversation || !window.confirm(`Excluir a conversa “${activeConversation.title}”?`)) return
    setStore(current => {
      const remaining = current.conversations.filter(item => item.id !== activeConversation.id)
      const conversations = remaining.length ? remaining : [createConversation()]
      return { ...current, conversations, activeConversationId: conversations[0].id }
    })
    setQuestion('')
    setError('')
  }

  const askQuestion = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeConversation || loadingConversationId) return
    const cleanQuestion = question.trim()
    if (cleanQuestion.length < 3) return

    const conversationId = activeConversation.id
    const previousMessages = activeConversation.messages
    const now = new Date().toISOString()
    const userMessage: DevotionalMessage = { id: makeId(), role: 'user', content: cleanQuestion, createdAt: now }
    setStore(current => updateConversation(current, conversationId, item => ({
      ...item,
      title: item.messages.length === 0 && item.title === 'Nova conversa' ? shortTitle(cleanQuestion) : item.title,
      updatedAt: now,
      messages: [...item.messages, userMessage],
    })))
    setQuestion('')
    setError('')
    setLoadingConversationId(conversationId)

    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller
    try {
      const answer = await askBibleGuide({
        question: cleanQuestion,
        guideMode: 'devotional',
        conversation: previousMessages.slice(-6).map(item => ({ role: item.role, content: item.content })),
      }, controller.signal)
      const answerTime = new Date().toISOString()
      const assistantMessage: DevotionalMessage = { id: makeId(), role: 'assistant', content: answer, createdAt: answerTime }
      setStore(current => updateConversation(current, conversationId, item => ({
        ...item,
        updatedAt: answerTime,
        messages: [...item.messages, assistantMessage],
      })))
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
        setError(requestError instanceof Error ? requestError.message : 'O Devocional está indisponível agora.')
      }
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null
      setLoadingConversationId('')
    }
  }

  const chooseSuggestion = (suggestion: string) => {
    setQuestion(suggestion)
    setError('')
    window.requestAnimationFrame(() => questionRef.current?.focus())
  }

  const saveNotes = (notes: string) => {
    if (!activeConversation) return
    setStore(current => updateConversation(current, activeConversation.id, item => ({ ...item, notes, updatedAt: new Date().toISOString() })))
  }

  const selectPanel = (nextPanel: 'chat' | 'notes', focus = false) => {
    setPanel(nextPanel)
    if (focus) window.requestAnimationFrame(() => (nextPanel === 'chat' ? chatTabRef : notesTabRef).current?.focus())
  }

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentPanel: 'chat' | 'notes') => {
    let nextPanel: 'chat' | 'notes' | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') nextPanel = currentPanel === 'chat' ? 'notes' : 'chat'
    else if (event.key === 'Home') nextPanel = 'chat'
    else if (event.key === 'End') nextPanel = 'notes'
    if (!nextPanel) return
    event.preventDefault()
    selectPanel(nextPanel, true)
  }

  return (
    <article className="devotional-page pb-6 pt-4">
      <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-5 text-center">
        <div className="text-5xl" aria-hidden="true">{playerAvatar}</div>
        <p className="mt-2 text-xs font-black uppercase tracking-widest" style={{ color: '#8A5A00' }}>Um momento com Jesus</p>
        <h1 className="devotional-page-title font-title mt-1 text-3xl" style={{ color: '#5B3A8A' }}>Devocional de {playerName}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed" style={{ color: '#2563A6' }}>
          Converse, estude e guarde suas descobertas bíblicas em um lugar especial. ✨
        </p>
      </motion.header>

      <div className="devotional-layout grid gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
        {(!mobileLayout || mobileView === 'history') && (
        <div
          className={mobileLayout ? 'fixed inset-0 z-[100] flex items-stretch bg-slate-950/50 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]' : ''}
          onMouseDown={event => { if (mobileLayout && event.target === event.currentTarget) closeHistory() }}
        >
        <aside
          className={`glass-card p-3 ${mobileLayout ? 'ml-auto flex h-full w-[min(92vw,360px)] flex-col overflow-hidden bg-white' : ''}`}
          aria-label="Conversas do devocional"
          role={mobileLayout ? 'dialog' : undefined}
          aria-modal={mobileLayout ? 'true' : undefined}
          aria-labelledby={mobileLayout ? 'devotional-history-title' : undefined}
        >
          {mobileLayout && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="devotional-history-title" className="font-title text-xl" style={{ color: '#5B3A8A' }}>Minhas conversas</h2>
              <button ref={historyCloseRef} type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-purple-50 text-xl font-black" style={{ color: '#5B3A8A' }} aria-label="Fechar histórico de conversas" onClick={() => closeHistory()}>×</button>
            </div>
          )}
          <button type="button" className="btn-primary w-full text-sm" style={{ minHeight: 44 }} onClick={addConversation}>
            <Plus size={18} aria-hidden="true" /> Nova conversa
          </button>
          <label className="relative mt-3 block">
            <span className="sr-only">Buscar conversa</span>
            <Search className="absolute left-3 top-3" size={17} aria-hidden="true" style={{ color: '#6B7280' }} />
            <input value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 w-full rounded-xl border border-purple-100 bg-white/90 py-2 pl-9 pr-3 text-sm" placeholder="Buscar conversa" />
          </label>
          <label className="mt-2 block text-sm font-bold" style={{ color: '#4B5563' }}>
            Organizar por
            <select value={sortMode} onChange={event => setSortMode(event.target.value as 'recent' | 'name')} className="mt-1 min-h-11 w-full rounded-xl border border-purple-100 bg-white px-2 text-sm">
              <option value="recent">Data mais recente</option>
              <option value="name">Nome</option>
            </select>
          </label>
          <nav className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto md:max-h-[620px] md:flex-none" aria-label="Histórico de conversas">
            {visibleConversations.map(item => {
              const preview = item.messages[item.messages.length - 1]?.content || 'Comece uma nova descoberta…'
              return (
                <button key={item.id} type="button" onClick={() => selectConversation(item.id)} aria-current={item.id === activeConversation?.id ? 'page' : undefined} className="min-h-16 w-full rounded-2xl border p-3 text-left transition-colors" style={{ background: item.id === activeConversation?.id ? '#F3E8FF' : 'rgba(255,255,255,.8)', borderColor: item.id === activeConversation?.id ? '#C4B5FD' : '#EDE9FE' }}>
                  <span className="block truncate text-sm font-black" style={{ color: '#5B3A8A' }}>{item.title}</span>
                  <span className="mt-1 block truncate text-xs" style={{ color: '#4B5563' }}>{preview}</span>
                  <span className="mt-1 block text-xs font-bold" style={{ color: '#6B7280' }}>{item.title === 'Histórico anterior' ? 'Importado' : conversationDateLabel(item.updatedAt)}</span>
                </button>
              )
            })}
            {!visibleConversations.length && <p className="p-3 text-center text-sm" style={{ color: '#6B7280' }}>Nenhuma conversa encontrada.</p>}
          </nav>
        </aside>
        </div>
        )}

        {activeConversation && (
          <section className="devotional-workspace glass-card min-w-0 overflow-clip" aria-labelledby="active-conversation-title">
            <header className="devotional-workspace-header flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 p-3 sm:p-4">
              <div className="devotional-title-block min-w-0 flex-1">
                <p className="text-xs font-bold" style={{ color: '#2563A6' }}>{conversationDateLabel(activeConversation.updatedAt)}</p>
                <h2 ref={activeTitleRef} id="active-conversation-title" tabIndex={-1} className="devotional-conversation-title font-black" style={{ color: '#5B3A8A' }}>{activeConversation.title}</h2>
              </div>
              <div className="devotional-title-actions flex gap-1">
                <button ref={historyTriggerRef} type="button" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-50 px-3 text-sm font-black md:hidden" style={{ color: '#5B3A8A' }} aria-haspopup="dialog" aria-expanded={mobileView === 'history'} onClick={() => setMobileView('history')}><MessagesSquare size={17} aria-hidden="true" /> Conversas</button>
                <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white" aria-label="Renomear conversa" onClick={renameConversation}><Pencil size={17} /></button>
                <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-orange-50" style={{ color: '#92400E' }} aria-label="Excluir conversa" onClick={deleteConversation}><Trash2 size={17} /></button>
              </div>
            </header>

            <div className="devotional-tabs flex border-b border-purple-100 p-2" role="tablist" aria-label="Conteúdo do devocional">
              <button ref={chatTabRef} id="devotional-tab-chat" type="button" role="tab" aria-selected={panel === 'chat'} aria-controls="devotional-panel-chat" tabIndex={panel === 'chat' ? 0 : -1} onKeyDown={event => handleTabKeyDown(event, 'chat')} onClick={() => selectPanel('chat')} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black" style={{ color: '#5B3A8A', background: panel === 'chat' ? '#F3E8FF' : 'transparent' }}><MessageCircleQuestion size={18} aria-hidden="true" /> Conversa</button>
              <button ref={notesTabRef} id="devotional-tab-notes" type="button" role="tab" aria-selected={panel === 'notes'} aria-controls="devotional-panel-notes" tabIndex={panel === 'notes' ? 0 : -1} onKeyDown={event => handleTabKeyDown(event, 'notes')} onClick={() => selectPanel('notes')} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black" style={{ color: '#5B3A8A', background: panel === 'notes' ? '#FFF7D6' : 'transparent' }}><FileText size={18} aria-hidden="true" /> Bloco de notas</button>
            </div>

            {panel === 'notes' ? (
              <div id="devotional-panel-notes" className="devotional-notes-panel p-4" role="tabpanel" aria-labelledby="devotional-tab-notes">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-100" style={{ color: '#8A5A00' }}><BookHeart size={23} /></div>
                  <div>
                    <h3 className="font-black" style={{ color: '#5B3A8A' }}>Minhas anotações</h3>
                    <p className="text-sm" style={{ color: '#4B5563' }}>Escreva o que aprendeu, uma oração ou algo que deseja praticar.</p>
                  </div>
                </div>
                <label htmlFor="devotional-notes" className="text-sm font-bold">Anotações desta conversa</label>
                <textarea id="devotional-notes" value={activeConversation.notes} onChange={event => saveNotes(event.target.value)} maxLength={6000} className="mt-2 min-h-64 w-full rounded-2xl border border-yellow-200 bg-yellow-50/70 p-4 text-sm leading-relaxed" placeholder="Hoje eu aprendi que…" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span style={{ color: '#6B7280' }}>{activeConversation.notes.length}/6000</span>
                  <span className="flex items-center gap-1 font-bold" style={{ color: saveStatus === 'error' ? '#B91C1C' : '#047857' }}>
                    {saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'error' ? 'Não foi possível salvar' : <><Check size={15} /> Salvo neste aparelho</>}
                  </span>
                </div>
                <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{saveStatus === 'error' ? 'Não foi possível salvar as anotações.' : ''}</p>
              </div>
            ) : (
              <div id="devotional-panel-chat" className="devotional-chat-panel" role="tabpanel" aria-labelledby="devotional-tab-chat">
                <div ref={messageLogRef} className="devotional-message-log min-h-56 space-y-3 overflow-y-auto bg-gradient-to-b from-purple-50/50 to-blue-50/40 p-3 sm:p-4" role="log" aria-live="polite" aria-relevant="additions text" aria-atomic="false" aria-label="Mensagens do devocional">
                  {activeConversation.messages.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-4xl" aria-hidden="true">🌱</p>
                      <h3 className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Qual será nossa descoberta de hoje?</h3>
                      <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: '#4B5563' }}>Faça uma pergunta ou escolha uma sugestão. Cada assunto pode ter sua própria conversa.</p>
                    </div>
                  ) : activeConversation.messages.map(message => (
                    <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className="min-w-0 max-w-[88%] rounded-2xl px-3 py-2 shadow-sm" style={{ background: message.role === 'user' ? '#DDEBFF' : '#FFFFFF', borderBottomRightRadius: message.role === 'user' ? 4 : 16, borderBottomLeftRadius: message.role === 'assistant' ? 4 : 16, overflowWrap: 'anywhere' }}>
                        <p className="text-xs font-black" style={{ color: message.role === 'user' ? '#1D4E89' : '#5B3A8A' }}>{message.role === 'user' ? 'Você' : 'Devocional ✨'}</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" style={{ color: '#374151' }}>{message.content}</p>
                        <time className="mt-1 block text-right text-xs" dateTime={message.createdAt} style={{ color: '#6B7280' }}>{messageTime(message.createdAt)}</time>
                      </div>
                    </article>
                  ))}
                  {loadingConversationId === activeConversation.id && <p className="rounded-2xl bg-white px-3 py-3 text-sm font-bold" style={{ color: '#5B3A8A' }}>Preparando uma resposta com carinho… ✨📖</p>}
                </div>

                <form className="devotional-composer border-t border-purple-100 bg-white/95 p-3 sm:p-4" onSubmit={askQuestion}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black" style={{ color: '#5B3A8A' }}>Você também pode perguntar…</p>
                    <span id="devotional-suggestions-help" className="text-xs font-bold sm:sr-only" style={{ color: '#2563A6' }}>Deslize para ver mais →</span>
                  </div>
                  <div className="devotional-suggestions mb-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2" aria-label="Perguntas sugeridas" aria-describedby="devotional-suggestions-help">
                    {suggestions.map(suggestion => (
                      <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)} className="min-h-11 min-w-[calc(100%-2rem)] snap-start rounded-2xl border border-purple-200 bg-white px-3 py-2 text-left text-sm font-bold active:scale-95 sm:min-w-[190px]" style={{ color: '#5B3A8A' }}>{suggestion}</button>
                    ))}
                  </div>
                  <label className="sr-only" htmlFor="devotional-question">Minha pergunta</label>
                  <div className="flex items-end gap-2">
                    <textarea ref={questionRef} id="devotional-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={MAX_QUESTION_CHARS} className="min-h-24 min-w-0 flex-1 resize-y rounded-2xl border border-purple-200 bg-white px-3 py-3 text-sm" placeholder="Escreva sua pergunta para continuar a conversa…" />
                    <button type="submit" className="btn-primary min-h-12 min-w-12 px-3" aria-label="Enviar pergunta" disabled={Boolean(loadingConversationId) || question.trim().length < 3}><Send size={19} /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: '#4B5563' }}>
                    <span>{question.length}/{MAX_QUESTION_CHARS}</span>
                    <span className="flex items-center gap-1"><Sparkles size={14} /> Não escreva nome completo, endereço, escola ou telefone.</span>
                  </div>
                  {error && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm" style={{ color: '#92400E' }} role="alert">{error}</p>}
                  {saveStatus === 'error' && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm" style={{ color: '#B91C1C' }} role="alert">O navegador não conseguiu salvar esta conversa. Libere espaço e tente novamente.</p>}
                </form>
              </div>
            )}
          </section>
        )}
      </div>
    </article>
  )
}
