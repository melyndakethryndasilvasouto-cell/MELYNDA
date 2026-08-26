import assert from 'node:assert/strict'
import test from 'node:test'
import { createPagesBibleGuideHandler } from '../functions/api/bible-guide/index.js'
import { onRequest as statusHandler } from '../functions/api/bible-guide/status.js'

function request(path = '/api/bible-guide', init = {}) {
  return new Request(`https://mel-jogos.pages.dev${path}`, {
    method: 'POST',
    headers: {
      Origin: 'https://mel-jogos.pages.dev',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.10',
      ...init.headers,
    },
    body: JSON.stringify({
      question: 'Como praticar esta mensagem?',
      theme: 'Coragem',
      verseRef: 'Josué 1:9',
      message: 'Deus nos ajuda a ter coragem.',
    }),
    ...init,
  })
}

test('função Cloudflare mantém a chave fora do cliente e responde pela Groq', async () => {
  let authorization = ''
  const handler = createPagesBibleGuideHandler({
    fetchImpl: async (_url, init) => {
      authorization = init.headers.Authorization
      return Response.json({ choices: [{ message: { content: '**A passagem ensina** que Deus nos acompanha.' } }] })
    },
  })
  const response = await handler({ request: request(), env: { GROQ_API_KEY: 'segredo-de-teste' } })
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(authorization, 'Bearer segredo-de-teste')
  assert.equal(payload.answer, 'A passagem ensina que Deus nos acompanha.')
  assert.doesNotMatch(JSON.stringify(payload), /segredo-de-teste/)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})

test('função Cloudflare encaminha o modo devocional sem dados do jogador', async () => {
  let upstreamBody
  const handler = createPagesBibleGuideHandler({
    fetchImpl: async (_url, init) => {
      upstreamBody = JSON.parse(init.body)
      return Response.json({ choices: [{ message: { content: 'Jesus nos recebe com amor. Confira João 3:16 na NTLH.' } }] })
    },
  })
  const response = await handler({
    request: request('/api/bible-guide', {
      body: JSON.stringify({
        question: 'Quem é Jesus?',
        guideMode: 'devotional',
      }),
    }),
    env: { GROQ_API_KEY: 'segredo-de-teste' },
  })

  assert.equal(response.status, 200)
  assert.match(upstreamBody.messages[1].content, /Modo: devocional pessoal infantil/)
  assert.doesNotMatch(JSON.stringify(upstreamBody), /nome do jogador|playerName/i)
})

test('função Cloudflare não envia situação infantil de perigo ao provedor externo', async () => {
  let called = false
  const handler = createPagesBibleGuideHandler({ fetchImpl: async () => { called = true } })
  const response = await handler({
    request: request('/api/bible-guide', {
      body: JSON.stringify({
        question: 'Quero me machucar e não quero viver.',
        guideMode: 'devotional',
      }),
    }),
    env: { GROQ_API_KEY: 'segredo-de-teste' },
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.match(payload.answer, /adulto de confiança/)
  assert.equal(payload.model, null)
  assert.equal(called, false)
})
test('função Cloudflare bloqueia origem externa antes de acessar a Groq', async () => {
  let called = false
  const handler = createPagesBibleGuideHandler({ fetchImpl: async () => { called = true } })
  const response = await handler({
    request: request('/api/bible-guide', { headers: { Origin: 'https://example.com' } }),
    env: { GROQ_API_KEY: 'segredo-de-teste' },
  })
  assert.equal(response.status, 403)
  assert.equal(called, false)
})

test('função Cloudflare apresenta estado seguro quando o Guia não está ativado', async () => {
  const handler = createPagesBibleGuideHandler()
  const response = await handler({ request: request(), env: {} })
  assert.equal(response.status, 503)
  assert.match((await response.json()).error, /ainda não foi ativado/)

  const statusResponse = await statusHandler({
    request: new Request('https://mel-jogos.pages.dev/api/bible-guide/status'),
    env: {},
  })
  assert.deepEqual(await statusResponse.json(), { enabled: false, model: null })
})
