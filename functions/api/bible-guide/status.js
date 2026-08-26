import { groqGuideConfig } from '../../../server/groq-bible-guide.mjs'

export function onRequest(context) {
  if (context.request.method !== 'GET') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405 })
  }
  const enabled = Boolean(context.env?.GROQ_API_KEY)
  return Response.json({
    enabled,
    model: enabled ? (context.env.GROQ_MODEL || groqGuideConfig.defaultModel) : null,
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
