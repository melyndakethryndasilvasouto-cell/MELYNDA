export type BibleGuideMode = 'mission' | 'devotional'

export interface BibleGuideRequest {
  question: string
  guideMode: BibleGuideMode
  theme?: string
  verseRef?: string
  message?: string
}

interface BibleGuideResponse {
  answer?: string
  error?: string
}

export async function askBibleGuide(payload: BibleGuideRequest, signal?: AbortSignal) {
  const response = await fetch('/api/bible-guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  const result = await response.json().catch(() => ({})) as BibleGuideResponse
  if (!response.ok) throw new Error(result.error || 'O Guia Bíblico não conseguiu responder agora.')
  if (!result.answer) throw new Error('O Guia Bíblico retornou uma resposta vazia.')
  return result.answer
}
