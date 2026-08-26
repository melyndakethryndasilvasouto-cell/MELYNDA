import {
  buildMessages,
  childSafetyResponse,
  cleanAnswer,
  cleanText,
  groqGuideConfig,
  normalizeBiblicalAttribution,
} from '../../../server/groq-bible-guide.mjs'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_BODY_BYTES = 4_096
const RATE_WINDOW_MS = 60_000
const UPSTREAM_TIMEOUT_MS = 12_000
const buckets = new Map()

class GuideError extends Error {
  constructor(status, publicMessage) {
    super(publicMessage)
    this.status = status
    this.publicMessage = publicMessage
  }
}

function json(status, payload) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function isSameOrigin(request) {
  const origin = request.headers.get('Origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

async function readJsonBody(request) {
  const declaredSize = Number(request.headers.get('Content-Length') || 0)
  if (declaredSize > MAX_BODY_BYTES) {
    throw new GuideError(413, 'A pergunta ficou grande demais. Resuma e tente novamente.')
  }
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    throw new GuideError(413, 'A pergunta ficou grande demais. Resuma e tente novamente.')
  }
  try {
    return JSON.parse(rawBody)
  } catch {
    throw new GuideError(400, 'Não foi possível entender a pergunta.')
  }
}

function consumeRateLimit(address, now, limit) {
  const timestamp = now()
  const current = buckets.get(address)
  if (!current || timestamp - current.startedAt >= RATE_WINDOW_MS) {
    buckets.set(address, { startedAt: timestamp, count: 1 })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

export function createPagesBibleGuideHandler(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const now = options.now || Date.now
  const rateLimit = options.rateLimit || groqGuideConfig.maxRequestsPerWindow

  return async function handle(context) {
    const { request, env = {} } = context
    try {
      if (request.method !== 'POST') throw new GuideError(405, 'Método não permitido.')
      if (!isSameOrigin(request)) throw new GuideError(403, 'Origem da solicitação não autorizada.')

      const apiKey = env.GROQ_API_KEY || ''
      const model = env.GROQ_MODEL || groqGuideConfig.defaultModel

      const contentType = (request.headers.get('Content-Type') || '').toLowerCase()
      if (!contentType.startsWith('application/json')) {
        throw new GuideError(415, 'Envie a pergunta no formato correto.')
      }

      const body = await readJsonBody(request)
      const question = cleanText(body.question, groqGuideConfig.maxQuestionChars + 1)
      const theme = cleanText(body.theme, 100)
      const verseRef = cleanText(body.verseRef, 80)
      const message = cleanText(body.message, 300)
      const guideMode = body.guideMode === 'devotional' ? 'devotional' : 'mission'
      if (question.length < 3) throw new GuideError(400, 'Escreva uma pergunta um pouco mais completa.')
      if (question.length > groqGuideConfig.maxQuestionChars) {
        throw new GuideError(400, 'A pergunta deve ter no máximo 400 caracteres.')
      }
      const safetyAnswer = childSafetyResponse(question)
      if (safetyAnswer) return json(200, { answer: safetyAnswer, model: null })
      if (!apiKey) throw new GuideError(503, 'O Guia Bíblico ainda não foi ativado neste site.')

      const address = request.headers.get('CF-Connecting-IP') || 'unknown'
      if (!consumeRateLimit(address, now, rateLimit)) {
        throw new GuideError(429, 'Muitas perguntas seguidas. Aguarde um minuto e tente novamente.')
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
      let upstream
      try {
        upstream = await fetchImpl(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: buildMessages({ question, theme, verseRef, message, guideMode }),
            temperature: 0.25,
            max_completion_tokens: 220,
            stream: false,
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!upstream.ok) {
        if (upstream.status === 429) {
          throw new GuideError(503, 'O serviço de IA atingiu o limite temporário. Tente novamente mais tarde.')
        }
        throw new GuideError(502, 'O Guia Bíblico não conseguiu responder agora. Confira a configuração e tente novamente.')
      }

      const data = await upstream.json()
      const answer = normalizeBiblicalAttribution(
        cleanAnswer(data?.choices?.[0]?.message?.content, 2_000),
        verseRef,
      )
      if (!answer) throw new GuideError(502, 'A IA retornou uma resposta vazia. Tente reformular a pergunta.')
      return json(200, { answer, model })
    } catch (error) {
      if (error instanceof GuideError) return json(error.status, { error: error.publicMessage })
      if (error?.name === 'AbortError') return json(504, { error: 'A resposta demorou demais. Tente novamente.' })
      return json(502, { error: 'O Guia Bíblico está temporariamente indisponível.' })
    }
  }
}

export const onRequest = createPagesBibleGuideHandler()
