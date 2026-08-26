import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { buildMessages, createGroqBibleGuideMiddleware, groqGuideConfig } from '../server/groq-bible-guide.mjs'

async function startGuide(options) {
  const middleware = createGroqBibleGuideMiddleware(options)
  const server = createServer((request, response) => {
    middleware(request, response, () => {
      response.statusCode = 404
      response.end('not found')
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  return { server, baseUrl: `http://127.0.0.1:${address.port}` }
}

function stop(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

async function postQuestion(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}${groqGuideConfig.apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl, ...headers },
    body: JSON.stringify(body),
  })
}

test('proxy Groq mantém a chave no servidor e envia prompt bíblico limitado', async t => {
  const secret = 'gsk_test_secret_never_expose'
  let upstreamRequest
  const { server, baseUrl } = await startGuide({
    apiKey: secret,
    model: 'openai/gpt-oss-20b',
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options, body: JSON.parse(options.body) }
      return new Response(JSON.stringify({ choices: [{ message: { content: '**Jesus diz que** o amor nos une. > Confira `Colossenses 3:14`.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  t.after(() => stop(server))

  const response = await postQuestion(baseUrl, {
    question: 'Como posso amar o próximo?',
    theme: 'Amor cristão',
    verseRef: 'Colossenses 3:14',
    message: 'O amor de Deus nos ensina a cuidar das pessoas.',
  })
  const text = await response.text()
  const payload = JSON.parse(text)

  assert.equal(response.status, 200)
  assert.match(payload.answer, /Colossenses 3:14/)
  assert.doesNotMatch(payload.answer, /\*\*|>|`/)
  assert.doesNotMatch(payload.answer, /Jesus diz/i)
  assert.match(payload.answer, /a passagem ensina/i)
  assert.equal(upstreamRequest.url, 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal(upstreamRequest.options.headers.Authorization, `Bearer ${secret}`)
  assert.equal(upstreamRequest.body.model, 'openai/gpt-oss-20b')
  assert.equal(upstreamRequest.body.reasoning_effort, 'low')
  assert.equal(upstreamRequest.body.max_completion_tokens, 1200)
  assert.match(upstreamRequest.body.messages[0].content, /Não invente versículos/)
  assert.match(upstreamRequest.body.messages[0].content, /Não use Markdown/)
  assert.match(upstreamRequest.body.messages[0].content, /a passagem ensina/)
  assert.match(upstreamRequest.body.messages[1].content, /O amor de Deus nos ensina/)
  assert.doesNotMatch(text, new RegExp(secret))
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('devocional orienta a IA com NTLH, linguagem infantil e cuidado cristocêntrico', () => {
  const messages = buildMessages({
    question: 'Como posso confiar em Deus quando estou com medo?',
    guideMode: 'devotional',
    conversation: [
      { role: 'user', content: 'Ontem falamos sobre oração.' },
      { role: 'assistant', content: 'Sim, Deus escuta você.' },
    ],
  })

  assert.match(messages[0].content, /perspectiva cristocêntrica/)
  assert.match(messages[0].content, /Nova Tradução na Linguagem de Hoje \(NTLH\)/)
  assert.match(messages[0].content, /Não use aspas nem apresente nenhuma frase como citação literal/)
  assert.match(messages[0].content, /apenas como leitura recomendada/)
  assert.match(messages[0].content, /linguagem clara para crianças/)
  assert.match(messages[0].content, /adulto confiável/)
  assert.match(messages[0].content, /Nunca prometa segredo/)
  assert.match(messages[0].content, /dois a quatro emojis/)
  assert.equal(messages[1].role, 'user')
  assert.match(messages[1].content, /Ontem falamos sobre oração/)
  assert.match(messages[1].content, /Resposta anterior: Sim, Deus escuta você/)
  assert.doesNotMatch(messages.slice(1, -1).map(item => item.role).join(','), /assistant/)
  assert.match(messages.at(-1).content, /Modo: devocional pessoal infantil/)
  assert.match(messages.at(-1).content, /ação simples para praticar/)
  assert.doesNotMatch(messages.at(-1).content, /Tema do jogo/)
})

test('proxy rejeita resposta interrompida por limite de saída', async t => {
  const { server, baseUrl } = await startGuide({
    apiKey: 'test-only',
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: 'Resposta incompleta' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  })
  t.after(() => stop(server))

  const response = await postQuestion(baseUrl, { question: 'Conte uma história sobre Jesus.' })
  assert.equal(response.status, 502)
  assert.match((await response.json()).error, /incompleta/)
})

test('pedido infantil de ajuda urgente recebe orientação local sem chamar a IA', async t => {
  let called = false
  const { server, baseUrl } = await startGuide({
    apiKey: 'test-only',
    fetchImpl: async () => { called = true },
  })
  t.after(() => stop(server))

  const response = await postQuestion(baseUrl, {
    question: 'Tenho medo de alguém que me bate e pediu segredo.',
    guideMode: 'devotional',
  })
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.match(payload.answer, /adulto de confiança/)
  assert.match(payload.answer, /Não guarde isso em segredo/)
  assert.equal(payload.model, null)
  assert.equal(called, false)
})

test('proxy informa configuração ausente sem tentar chamar a Groq', async t => {
  let called = false
  const { server, baseUrl } = await startGuide({ apiKey: '', fetchImpl: async () => { called = true } })
  t.after(() => stop(server))

  const statusResponse = await fetch(`${baseUrl}${groqGuideConfig.apiPath}/status`)
  assert.deepEqual(await statusResponse.json(), { enabled: false, model: null })

  const response = await postQuestion(baseUrl, { question: 'Quem foi Noé?' })
  assert.equal(response.status, 503)
  assert.match((await response.json()).error, /ainda não foi ativado/)
  assert.equal(called, false)
})

test('proxy bloqueia origem externa, entrada excessiva e rajadas', async t => {
  const fetchImpl = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Resposta segura.' } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const { server, baseUrl } = await startGuide({ apiKey: 'test-only', fetchImpl, rateLimit: 1 })
  t.after(() => stop(server))

  const foreign = await postQuestion(baseUrl, { question: 'Pergunta válida' }, { Origin: 'https://example.com' })
  assert.equal(foreign.status, 403)

  const withoutOrigin = await postQuestion(baseUrl, { question: 'Pergunta válida' }, { Origin: '' })
  assert.equal(withoutOrigin.status, 403)

  const long = await postQuestion(baseUrl, { question: 'a'.repeat(groqGuideConfig.maxQuestionChars + 1) })
  assert.equal(long.status, 400)

  const allowed = await postQuestion(baseUrl, { question: 'Primeira pergunta válida' })
  assert.equal(allowed.status, 200)

  const limited = await postQuestion(baseUrl, { question: 'Outra pergunta válida' })
  assert.equal(limited.status, 429)
})
