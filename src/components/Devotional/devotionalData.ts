export type DevotionalRole = 'user' | 'assistant'

export interface DevotionalMessage {
  id: string
  role: DevotionalRole
  content: string
  createdAt: string
}

export interface DevotionalConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: DevotionalMessage[]
  notes: string
}

export interface DevotionalStore {
  version: 2
  conversations: DevotionalConversation[]
  activeConversationId: string
}

const DEVICE_ID_KEY = 'mel-devotional-device-id-v1'
const MAX_CONVERSATIONS = 30
const MAX_MESSAGES_PER_CONVERSATION = 80
const MAX_NOTES_CHARS = 6_000

const fallbackId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
export const makeId = () => globalThis.crypto?.randomUUID?.() || fallbackId()

export function getDevotionalStorageKey(playerName: string) {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = makeId()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  const profile = encodeURIComponent(playerName.trim().toLocaleLowerCase('pt-BR') || 'jogador')
  return `mel-devotional-v2:${deviceId}:${profile}`
}

export function legacyHistoryKey(playerName: string) {
  return `mel-devotional-history-v1:${encodeURIComponent(playerName.trim().toLocaleLowerCase('pt-BR'))}`
}

export function createConversation(title = 'Nova conversa'): DevotionalConversation {
  const now = new Date().toISOString()
  return { id: makeId(), title, createdAt: now, updatedAt: now, messages: [], notes: '' }
}

function validMessage(value: unknown): value is DevotionalMessage {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string'
    && (item.role === 'user' || item.role === 'assistant')
    && typeof item.content === 'string'
    && typeof item.createdAt === 'string'
}

function validConversation(value: unknown): value is DevotionalConversation {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string'
    && typeof item.title === 'string'
    && typeof item.createdAt === 'string'
    && typeof item.updatedAt === 'string'
    && Array.isArray(item.messages)
    && item.messages.every(validMessage)
    && typeof item.notes === 'string'
}

function migrateLegacy(playerName: string): DevotionalConversation | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(legacyHistoryKey(playerName)) || '[]')
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const importedAt = new Date().toISOString()
    const messages: DevotionalMessage[] = []
    for (const item of parsed) {
      if (!item || typeof item.question !== 'string' || typeof item.answer !== 'string') continue
      messages.push(
        { id: makeId(), role: 'user', content: item.question, createdAt: importedAt },
        { id: makeId(), role: 'assistant', content: item.answer, createdAt: importedAt },
      )
    }
    if (!messages.length) return null
    return {
      id: makeId(),
      title: 'Histórico anterior',
      createdAt: importedAt,
      updatedAt: importedAt,
      messages: messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
      notes: '',
    }
  } catch {
    return null
  }
}

export function loadDevotionalStore(storageKey: string, playerName: string): DevotionalStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null') as Partial<DevotionalStore> | null
    if (parsed?.version === 2 && Array.isArray(parsed.conversations)) {
      const conversations = parsed.conversations.filter(validConversation).slice(0, MAX_CONVERSATIONS)
      if (conversations.length) {
        const activeConversationId = conversations.some(item => item.id === parsed.activeConversationId)
          ? String(parsed.activeConversationId)
          : conversations[0].id
        return { version: 2, conversations, activeConversationId }
      }
    }
  } catch {}

  const conversation = migrateLegacy(playerName) || createConversation()
  return { version: 2, conversations: [conversation], activeConversationId: conversation.id }
}

export function normalizeStore(store: DevotionalStore): DevotionalStore {
  const conversations = store.conversations.slice(0, MAX_CONVERSATIONS).map(item => ({
    ...item,
    title: item.title.trim().slice(0, 60) || 'Conversa sem nome',
    notes: item.notes.slice(0, MAX_NOTES_CHARS),
    messages: item.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
  }))
  return { ...store, conversations }
}

export function saveDevotionalStore(storageKey: string, store: DevotionalStore) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalizeStore(store)))
    return true
  } catch {
    return false
  }
}

const suggestionGroups = [
  {
    words: ['jesus', 'cristo', 'amor'],
    questions: [
      'Como Jesus mostra que me ama todos os dias?',
      'O que posso aprender com o jeito de Jesus tratar as pessoas?',
      'Como posso mostrar o amor de Jesus para alguém hoje?',
      'Por que Jesus veio ao mundo por nós?',
    ],
  },
  {
    words: ['oraç', 'deus', 'falar', 'pedido'],
    questions: [
      'Deus escuta até uma oração bem curtinha?',
      'Como posso agradecer a Deus em oração?',
      'O que faço quando não sei o que dizer para Deus?',
      'Posso orar em qualquer lugar?',
    ],
  },
  {
    words: ['medo', 'preocup', 'ansied', 'triste', 'sozinh'],
    questions: [
      'Qual promessa da Bíblia posso lembrar quando sinto medo?',
      'Como Jesus cuida de mim quando estou preocupado?',
      'Quem pode me ajudar quando meu coração está triste?',
      'Como posso entregar minha preocupação a Deus?',
    ],
  },
  {
    words: ['perdo', 'briga', 'raiva', 'machuc'],
    questions: [
      'Perdoar significa dizer que o erro foi certo?',
      'Como posso pedir perdão de coração?',
      'O que Jesus ensina sobre tratar quem me magoou?',
      'Como Deus me ajuda a deixar a raiva passar?',
    ],
  },
  {
    words: ['bíblia', 'palavra', 'versículo', 'estud'],
    questions: [
      'Como começo a ler a Bíblia e entender melhor?',
      'Qual história da Bíblia pode me ensinar sobre coragem?',
      'Como guardar a Palavra de Deus no coração?',
      'Por que a Bíblia é importante para quem segue Jesus?',
    ],
  },
]

const initialQuestions = [
  'Quem é Jesus e por que Ele me ama?',
  'Como posso falar com Deus em oração?',
  'O que a Bíblia ensina quando estou com medo?',
  'Como posso perdoar alguém?',
  'Como posso agradecer a Deus hoje?',
  'O que Jesus ensina sobre ser um bom amigo?',
  'Como posso confiar em Deus quando algo dá errado?',
  'Qual história da Bíblia ensina sobre coragem?',
]

function normalizeForSearch(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export function contextualSuggestions(draft: string, messages: DevotionalMessage[], count = 4) {
  const asked = new Set(messages.filter(item => item.role === 'user').map(item => item.content))
  const context = normalizeForSearch(`${draft} ${messages.slice(-4).map(item => item.content).join(' ')}`)
  const matching = suggestionGroups.filter(group => group.words.some(word => context.includes(normalizeForSearch(word))))
  const pool = [...matching.flatMap(group => group.questions), ...initialQuestions]
  const unique = [...new Set(pool)].filter(item => !asked.has(item))
  if (unique.length < count) return [...unique, ...initialQuestions.filter(item => !unique.includes(item))].slice(0, count)
  const offset = messages.filter(item => item.role === 'assistant').length % unique.length
  return [...unique.slice(offset), ...unique.slice(0, offset)].slice(0, count)
}

export function conversationDateLabel(value: string, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }).format(date)
}
