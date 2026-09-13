import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

type VoiceStatus = 'off' | 'requesting' | 'ready' | 'connecting' | 'connected' | 'error'

interface VoiceSignal {
  targetId?: string
  senderId?: string
  kind?: 'ready' | 'ready-ack' | 'offer' | 'answer' | 'candidate' | 'hangup'
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

const DISCONNECTED_GRACE_MS = 5_000

export function useRoomVoice(channel: RealtimeChannel | null, userId: string, hostId: string) {
  const [status, setStatus] = useState<VoiceStatus>('off')
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const otherReadyRef = useRef(false)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const disconnectedTimerRef = useRef<number | null>(null)
  const startPromiseRef = useRef<Promise<void> | null>(null)
  const offeringRef = useRef(false)
  const voiceSessionRef = useRef(0)
  const mountedRef = useRef(true)

  const broadcast = useCallback(async (payload: VoiceSignal) => {
    if (!channel) return
    await channel.send({ type: 'broadcast', event: 'voice-signal', payload: { ...payload, senderId: userId } })
  }, [channel, userId])

  const clearDisconnectedTimer = useCallback(() => {
    if (disconnectedTimerRef.current !== null) window.clearTimeout(disconnectedTimerRef.current)
    disconnectedTimerRef.current = null
  }, [])

  const closePeer = useCallback(() => {
    clearDisconnectedTimer()
    const peer = peerRef.current
    peerRef.current = null
    pendingCandidatesRef.current = []
    otherReadyRef.current = false
    offeringRef.current = false
    peer?.close()
  }, [clearDisconnectedTimer])

  const stopMedia = useCallback((updateUi = true) => {
    for (const track of streamRef.current?.getTracks() || []) track.stop()
    streamRef.current = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    if (updateUi && mountedRef.current) setMuted(false)
  }, [])

  const failConnection = useCallback((peer: RTCPeerConnection) => {
    if (peerRef.current !== peer) return
    voiceSessionRef.current += 1
    closePeer()
    stopMedia()
    if (mountedRef.current) {
      setStatus('error')
      setError('A voz não conseguiu manter a conexão nesta rede.')
    }
  }, [closePeer, stopMedia])

  const createPeer = useCallback(() => {
    if (peerRef.current) return peerRef.current
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    })
    for (const track of streamRef.current?.getTracks() || []) peer.addTrack(track, streamRef.current!)
    peer.onicecandidate = event => {
      if (event.candidate && peerRef.current === peer) void broadcast({ kind: 'candidate', candidate: event.candidate.toJSON() })
    }
    peer.ontrack = event => {
      if (peerRef.current !== peer) return
      const audio = remoteAudioRef.current || new Audio()
      remoteAudioRef.current = audio
      audio.autoplay = true
      audio.srcObject = event.streams[0]
      void audio.play().catch(() => {
        if (mountedRef.current) setError('Toque novamente em “Ativar voz” para ouvir o outro jogador.')
      })
    }
    peer.onconnectionstatechange = () => {
      if (peerRef.current !== peer) return
      if (peer.connectionState === 'connected') {
        clearDisconnectedTimer()
        if (mountedRef.current) setStatus('connected')
        return
      }
      if (peer.connectionState === 'failed') {
        failConnection(peer)
        return
      }
      if (peer.connectionState === 'disconnected' && disconnectedTimerRef.current === null) {
        disconnectedTimerRef.current = window.setTimeout(() => {
          disconnectedTimerRef.current = null
          if (peerRef.current === peer && peer.connectionState === 'disconnected') failConnection(peer)
        }, DISCONNECTED_GRACE_MS)
      }
    }
    peerRef.current = peer
    return peer
  }, [broadcast, clearDisconnectedTimer, failConnection])

  const createOffer = useCallback(async () => {
    if (userId !== hostId || !streamRef.current || !otherReadyRef.current || offeringRef.current) return
    const peer = createPeer()
    if (peer.signalingState !== 'stable') return
    offeringRef.current = true
    try {
      if (mountedRef.current) setStatus('connecting')
      const offer = await peer.createOffer()
      if (peerRef.current !== peer) return
      await peer.setLocalDescription(offer)
      await broadcast({ kind: 'offer', description: offer })
    } finally {
      offeringRef.current = false
    }
  }, [broadcast, createPeer, hostId, userId])

  const handleSignal = useCallback(async (signal: VoiceSignal) => {
    if (!signal || signal.senderId === userId || (signal.targetId && signal.targetId !== userId)) return
    try {
      if (signal.kind === 'ready') {
        otherReadyRef.current = true
        if (streamRef.current) {
          await broadcast({ kind: 'ready-ack', targetId: signal.senderId })
          await createOffer()
        }
        return
      }
      if (signal.kind === 'ready-ack') {
        otherReadyRef.current = true
        await createOffer()
        return
      }
      if (signal.kind === 'hangup') {
        voiceSessionRef.current += 1
        closePeer()
        stopMedia()
        if (mountedRef.current) {
          setStatus('off')
          setError('')
        }
        return
      }
      if (!streamRef.current) return
      const peer = createPeer()
      if (signal.kind === 'offer' && signal.description) {
        if (mountedRef.current) setStatus('connecting')
        await peer.setRemoteDescription(signal.description)
        for (const candidate of pendingCandidatesRef.current.splice(0)) await peer.addIceCandidate(candidate)
        const answer = await peer.createAnswer()
        if (peerRef.current !== peer) return
        await peer.setLocalDescription(answer)
        await broadcast({ kind: 'answer', description: answer })
      } else if (signal.kind === 'answer' && signal.description) {
        await peer.setRemoteDescription(signal.description)
        for (const candidate of pendingCandidatesRef.current.splice(0)) await peer.addIceCandidate(candidate)
      } else if (signal.kind === 'candidate' && signal.candidate) {
        if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate)
        else pendingCandidatesRef.current.push(signal.candidate)
      }
    } catch {
      closePeer()
      stopMedia()
      if (mountedRef.current) {
        setStatus('error')
        setError('Não foi possível iniciar a conversa por voz.')
      }
    }
  }, [broadcast, closePeer, createOffer, createPeer, stopMedia, userId])

  const start = useCallback(async () => {
    if (startPromiseRef.current) return startPromiseRef.current

    const task = (async () => {
      const voiceSession = voiceSessionRef.current
      if (streamRef.current) {
        if (mountedRef.current) {
          setMuted(false)
          setError('')
          setStatus(peerRef.current?.connectionState === 'connected' ? 'connected' : 'ready')
        }
        for (const track of streamRef.current.getAudioTracks()) track.enabled = true
        await broadcast({ kind: 'ready' })
        await createOffer()
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        if (mountedRef.current) {
          setStatus('error')
          setError('Este navegador não oferece acesso seguro ao microfone.')
        }
        return
      }
      if (mountedRef.current) {
        setStatus('requesting')
        setError('')
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (!mountedRef.current || voiceSession !== voiceSessionRef.current) {
          for (const track of stream.getTracks()) track.stop()
          return
        }
        streamRef.current = stream
        setStatus('ready')
        setMuted(false)
        await broadcast({ kind: 'ready' })
        await createOffer()
      } catch {
        if (voiceSession !== voiceSessionRef.current) return
        stopMedia()
        if (mountedRef.current) {
          setStatus('error')
          setError('O microfone não foi permitido. Você ainda pode usar o chat.')
        }
      }
    })()

    startPromiseRef.current = task
    try {
      await task
    } finally {
      if (startPromiseRef.current === task) startPromiseRef.current = null
    }
  }, [broadcast, createOffer, stopMedia])

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return
    const next = !muted
    for (const track of streamRef.current.getAudioTracks()) track.enabled = !next
    setMuted(next)
  }, [muted])

  const stop = useCallback(() => {
    voiceSessionRef.current += 1
    void broadcast({ kind: 'hangup' })
    closePeer()
    stopMedia()
    if (mountedRef.current) {
      setStatus('off')
      setError('')
    }
  }, [broadcast, closePeer, stopMedia])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      voiceSessionRef.current += 1
      startPromiseRef.current = null
      closePeer()
      stopMedia(false)
    }
  }, [closePeer, stopMedia])

  return { status, muted, error, start, stop, toggleMute, handleSignal }
}
