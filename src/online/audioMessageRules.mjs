export const AUDIO_MESSAGE_MAX_DURATION_MS = 10_000
export const AUDIO_MESSAGE_MAX_BYTES = 180 * 1024
export const AUDIO_MESSAGE_MAX_BROADCAST_BYTES = 256 * 1024
export const AUDIO_MESSAGE_BITS_PER_SECOND = 24_000
export const AUDIO_MESSAGE_BROADCAST_ENVELOPE_BYTES = 2_048

export const AUDIO_MESSAGE_MIME_TYPES = Object.freeze([
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
])

function normalizeMimeType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '') : ''
}

export function isAllowedAudioMimeType(value) {
  const normalized = normalizeMimeType(value)
  return AUDIO_MESSAGE_MIME_TYPES.some(type => normalizeMimeType(type) === normalized)
}

export function pickSupportedAudioMimeType(isTypeSupported) {
  if (typeof isTypeSupported !== 'function') return ''
  return AUDIO_MESSAGE_MIME_TYPES.find(type => {
    try {
      return Boolean(isTypeSupported(type))
    } catch {
      return false
    }
  }) || ''
}

export function estimateAudioBroadcastBytes(binaryBytes, envelopeBytes = AUDIO_MESSAGE_BROADCAST_ENVELOPE_BYTES) {
  if (!Number.isFinite(binaryBytes) || binaryBytes < 0) return Number.POSITIVE_INFINITY
  const base64Bytes = 4 * Math.ceil(binaryBytes / 3)
  return base64Bytes + Math.max(0, Number(envelopeBytes) || 0)
}

export function validateAudioMessage({ size, durationMs, mimeType } = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { ok: false, code: 'invalid-duration', message: 'O áudio não tem uma duração válida.' }
  }
  if (durationMs > AUDIO_MESSAGE_MAX_DURATION_MS) {
    return { ok: false, code: 'too-long', message: 'O áudio pode ter no máximo 10 segundos.' }
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, code: 'empty', message: 'Não foi possível ouvir esse áudio. Grave novamente.' }
  }
  if (size > AUDIO_MESSAGE_MAX_BYTES || estimateAudioBroadcastBytes(size) > AUDIO_MESSAGE_MAX_BROADCAST_BYTES) {
    return { ok: false, code: 'too-large', message: 'O áudio ficou muito grande. Grave uma mensagem mais curta.' }
  }
  if (!isAllowedAudioMimeType(mimeType)) {
    return { ok: false, code: 'unsupported-type', message: 'Este formato de áudio não é compatível.' }
  }
  return { ok: true, code: 'ok', message: '' }
}
