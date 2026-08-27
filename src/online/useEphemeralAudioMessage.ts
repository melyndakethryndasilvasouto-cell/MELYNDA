import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AUDIO_MESSAGE_BITS_PER_SECOND,
  AUDIO_MESSAGE_MAX_BYTES,
  AUDIO_MESSAGE_MAX_DURATION_MS,
  pickSupportedAudioMimeType,
  validateAudioMessage,
} from './audioMessageRules.mjs'

export type EphemeralAudioStatus = 'idle' | 'requesting' | 'recording' | 'preview' | 'sending' | 'error'

export interface EphemeralAudioPreview {
  blob: Blob
  url: string
  mimeType: string
  durationMs: number
  size: number
}

export interface EphemeralAudioBroadcastPayload {
  id: string
  dataBase64: string
  mimeType: string
  durationMs: number
  size: number
}

export type EphemeralAudioSender = (payload: EphemeralAudioBroadcastPayload) => Promise<void>

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function useEphemeralAudioMessage(onSend: EphemeralAudioSender) {
  const [status, setStatus] = useState<EphemeralAudioStatus>('idle')
  const [preview, setPreview] = useState<EphemeralAudioPreview | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)
  const sessionRef = useRef(0)
  const mountedRef = useRef(true)
  const timeoutRef = useRef<number | null>(null)
  const progressRef = useRef<number | null>(null)
  const previewRef = useRef<EphemeralAudioPreview | null>(null)

  previewRef.current = preview

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    if (progressRef.current !== null) window.clearInterval(progressRef.current)
    timeoutRef.current = null
    progressRef.current = null
  }, [])

  const stopTracks = useCallback(() => {
    for (const track of streamRef.current?.getTracks() || []) track.stop()
    streamRef.current = null
  }, [])

  const revokePreview = useCallback(() => {
    const current = previewRef.current
    if (current) URL.revokeObjectURL(current.url)
    previewRef.current = null
    if (mountedRef.current) setPreview(null)
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording' || recorder?.state === 'paused') recorder.stop()
  }, [])

  const discard = useCallback(() => {
    sessionRef.current += 1
    clearTimers()
    stopRecording()
    stopTracks()
    recorderRef.current = null
    revokePreview()
    if (mountedRef.current) {
      setElapsedMs(0)
      setError('')
      setStatus('idle')
    }
  }, [clearTimers, revokePreview, stopRecording, stopTracks])

  const startRecording = useCallback(async () => {
    if (recorderRef.current || status === 'requesting' || status === 'sending') return
    const sessionId = sessionRef.current + 1
    sessionRef.current = sessionId
    revokePreview()
    setError('')
    setElapsedMs(0)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('error')
      setError('Este navegador não oferece gravação segura de áudio.')
      return
    }

    const mimeType = pickSupportedAudioMimeType(type => MediaRecorder.isTypeSupported(type))
    if (!mimeType) {
      setStatus('error')
      setError('Este navegador não oferece um formato de áudio compatível.')
      return
    }

    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      if (!mountedRef.current || sessionId !== sessionRef.current) {
        for (const track of stream.getTracks()) track.stop()
        return
      }

      streamRef.current = stream
      const chunks: Blob[] = []
      let recordedBytes = 0
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_MESSAGE_BITS_PER_SECOND })
      recorderRef.current = recorder

      recorder.ondataavailable = event => {
        if (sessionId !== sessionRef.current || !event.data.size) return
        recordedBytes += event.data.size
        chunks.push(event.data)
        if (recordedBytes > AUDIO_MESSAGE_MAX_BYTES && recorder.state !== 'inactive') recorder.stop()
      }

      recorder.onerror = () => {
        if (sessionId !== sessionRef.current) return
        sessionRef.current += 1
        clearTimers()
        stopTracks()
        recorderRef.current = null
        if (mountedRef.current) {
          setStatus('error')
          setError('Não foi possível gravar o áudio. Tente novamente.')
        }
      }

      recorder.onstop = () => {
        if (sessionId !== sessionRef.current) {
          for (const track of stream.getTracks()) track.stop()
          return
        }
        clearTimers()
        stopTracks()
        recorderRef.current = null
        if (!mountedRef.current) return

        const durationMs = Math.min(AUDIO_MESSAGE_MAX_DURATION_MS, Math.max(1, Date.now() - startedAtRef.current))
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType })
        const validation = validateAudioMessage({ size: blob.size, durationMs, mimeType: blob.type })
        if (!validation.ok) {
          setStatus('error')
          setError(validation.message)
          setElapsedMs(0)
          return
        }

        const nextPreview = {
          blob,
          url: URL.createObjectURL(blob),
          mimeType: blob.type,
          durationMs,
          size: blob.size,
        }
        previewRef.current = nextPreview
        setPreview(nextPreview)
        setElapsedMs(durationMs)
        setStatus('preview')
      }

      startedAtRef.current = Date.now()
      recorder.start(250)
      setStatus('recording')
      progressRef.current = window.setInterval(() => {
        setElapsedMs(Math.min(AUDIO_MESSAGE_MAX_DURATION_MS, Date.now() - startedAtRef.current))
      }, 200)
      timeoutRef.current = window.setTimeout(stopRecording, AUDIO_MESSAGE_MAX_DURATION_MS)
    } catch {
      stopTracks()
      recorderRef.current = null
      if (mountedRef.current) {
        setStatus('error')
        setError('O microfone não foi permitido. Você ainda pode escrever uma mensagem.')
      }
    }
  }, [clearTimers, revokePreview, status, stopRecording, stopTracks])

  const send = useCallback(async () => {
    const current = previewRef.current
    if (!current || status === 'sending') return
    const validation = validateAudioMessage(current)
    if (!validation.ok) {
      setStatus('error')
      setError(validation.message)
      return
    }

    setStatus('sending')
    setError('')
    try {
      const dataBase64 = bufferToBase64(await current.blob.arrayBuffer())
      await onSend({
        id: makeId(),
        dataBase64,
        mimeType: current.mimeType,
        durationMs: current.durationMs,
        size: current.size,
      })
      revokePreview()
      setElapsedMs(0)
      setStatus('idle')
    } catch {
      setStatus('preview')
      setError('Não foi possível enviar o áudio. Tente novamente ou apague a gravação.')
    }
  }, [onSend, revokePreview, status])

  useEffect(() => () => {
    mountedRef.current = false
    sessionRef.current += 1
    clearTimers()
    const recorder = recorderRef.current
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') recorder.stop()
    }
    recorderRef.current = null
    stopTracks()
    const current = previewRef.current
    if (current) URL.revokeObjectURL(current.url)
    previewRef.current = null
  }, [clearTimers, stopTracks])

  return {
    status,
    preview,
    elapsedMs,
    error,
    maxDurationMs: AUDIO_MESSAGE_MAX_DURATION_MS,
    startRecording,
    stopRecording,
    discard,
    send,
  }
}
