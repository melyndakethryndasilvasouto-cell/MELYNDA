import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUDIO_MESSAGE_BITS_PER_SECOND,
  AUDIO_MESSAGE_MAX_BROADCAST_BYTES,
  AUDIO_MESSAGE_MAX_BYTES,
  AUDIO_MESSAGE_MAX_DURATION_MS,
  AUDIO_MESSAGE_MIME_TYPES,
  estimateAudioBroadcastBytes,
  isAllowedAudioMimeType,
  pickSupportedAudioMimeType,
  validateAudioMessage,
} from '../src/online/audioMessageRules.mjs'

test('regras de áudio usam duração, bitrate e tamanho conservadores', () => {
  assert.equal(AUDIO_MESSAGE_MAX_DURATION_MS, 10_000)
  assert.equal(AUDIO_MESSAGE_MAX_BYTES, 180 * 1024)
  assert.ok(AUDIO_MESSAGE_BITS_PER_SECOND <= 24_000)
  assert.ok(estimateAudioBroadcastBytes(AUDIO_MESSAGE_MAX_BYTES) < AUDIO_MESSAGE_MAX_BROADCAST_BYTES)
})

test('seleciona o primeiro MIME de áudio realmente suportado', () => {
  const supported = new Set(['audio/mp4', 'audio/ogg'])
  assert.equal(pickSupportedAudioMimeType(type => supported.has(type)), 'audio/mp4')
  assert.equal(pickSupportedAudioMimeType(() => false), '')
  assert.equal(pickSupportedAudioMimeType(() => { throw new Error('browser failure') }), '')
  assert.equal(AUDIO_MESSAGE_MIME_TYPES[0], 'audio/webm;codecs=opus')
})

test('reconhece somente a lista fechada de formatos permitidos', () => {
  assert.equal(isAllowedAudioMimeType(' audio/webm; codecs=opus '), true)
  assert.equal(isAllowedAudioMimeType('audio/mp4'), true)
  assert.equal(isAllowedAudioMimeType('audio/wav'), false)
  assert.equal(isAllowedAudioMimeType('text/html'), false)
  assert.equal(isAllowedAudioMimeType(null), false)
})

test('valida áudio nos limites exatos', () => {
  assert.deepEqual(validateAudioMessage({
    size: AUDIO_MESSAGE_MAX_BYTES,
    durationMs: AUDIO_MESSAGE_MAX_DURATION_MS,
    mimeType: 'audio/webm;codecs=opus',
  }), { ok: true, code: 'ok', message: '' })
})

test('rejeita duração, conteúdo, tamanho e formato inseguros', () => {
  assert.equal(validateAudioMessage({ size: 1, durationMs: 0, mimeType: 'audio/webm' }).code, 'invalid-duration')
  assert.equal(validateAudioMessage({ size: 1, durationMs: 10_001, mimeType: 'audio/webm' }).code, 'too-long')
  assert.equal(validateAudioMessage({ size: 0, durationMs: 1_000, mimeType: 'audio/webm' }).code, 'empty')
  assert.equal(validateAudioMessage({ size: AUDIO_MESSAGE_MAX_BYTES + 1, durationMs: 1_000, mimeType: 'audio/webm' }).code, 'too-large')
  assert.equal(validateAudioMessage({ size: 100, durationMs: 1_000, mimeType: 'audio/wav' }).code, 'unsupported-type')
})

test('estimativa considera expansão base64 e envelope do Broadcast', () => {
  assert.equal(estimateAudioBroadcastBytes(3, 0), 4)
  assert.equal(estimateAudioBroadcastBytes(4, 0), 8)
  assert.equal(estimateAudioBroadcastBytes(-1), Number.POSITIVE_INFINITY)
  assert.equal(estimateAudioBroadcastBytes(Number.NaN), Number.POSITIVE_INFINITY)
})
