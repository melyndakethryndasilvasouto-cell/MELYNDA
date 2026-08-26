import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

type VoiceStatus = 'off' | 'requesting' | 'ready' | 'connecting' | 'connected' | 'error'

interface VoiceSignal {
  targetId?: string
  senderId?: string
  kind?: 'ready' | 'offer' | 'answer' | 'candidate' | 'hangup'
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export function useRoomVoice(channel: RealtimeChannel | null, userId: string, hostId: string) {
  const [status, setStatus] = useState<VoiceStatus>('off')
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const otherReadyRef = useRef(false)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  const broadcast = useCallback(async (payload: VoiceSignal) => {
    if (!channel) return
    await channel.send({ type: 'broadcast', event: 'voice-signal', payload: { ...payload, senderId: userId } })
  }, [channel, userId])

  const closePeer = useCallback(() => {
    peerRef.current?.close()
    peerRef.current = null
    pendingCandidatesRef.current = []
    otherReadyRef.current = false
  }, [])

  const createPeer = useCallback(() => {
    if (peerRef.current) return peerRef.current
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    })
    for (const track of streamRef.current?.getTracks() || []) peer.addTrack(track, streamRef.current!)
    peer.onicecandidate = event => {
      if (event.candidate) void broadcast({ kind: 'candidate', candidate: event.candidate.toJSON() })
    }
    peer.ontrack = event => {
      const audio = remoteAudioRef.current || new Audio()
      remoteAudioRef.current = audio
      audio.autoplay = true
      audio.srcObject = event.streams[0]
      void audio.play().catch(() => setError('Toque novamente em “Ativar voz” para ouvir o outro jogador.'))
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setStatus('connected')
      if (['failed', 'disconnected'].includes(peer.connectionState)) {
        setStatus('error')
        setError('A voz não conseguiu manter a conexão nesta rede.')
      }
    }
    peerRef.current = peer
    return peer
  }, [broadcast])

  const createOffer = useCallback(async () => {
    if (userId !== hostId || !streamRef.current || !otherReadyRef.current) return
    const peer = createPeer()
    if (peer.signalingState !== 'stable') return
    setStatus('connecting')
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    await broadcast({ kind: 'offer', description: offer })
  }, [broadcast, createPeer, hostId, userId])

  const handleSignal = useCallback(async (signal: VoiceSignal) => {
    if (!signal || signal.senderId === userId || (signal.targetId && signal.targetId !== userId)) return
    try {
      if (signal.kind === 'ready') {
        otherReadyRef.current = true
        await createOffer()
        return
      }
      if (signal.kind === 'hangup') {
        closePeer()
        setStatus(streamRef.current ? 'ready' : 'off')
        return
      }
      if (!streamRef.current) return
      const peer = createPeer()
      if (signal.kind === 'offer' && signal.description) {
        setStatus('connecting')
        await peer.setRemoteDescription(signal.description)
        for (const candidate of pendingCandidatesRef.current.splice(0)) await peer.addIceCandidate(candidate)
        const answer = await peer.createAnswer()
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
      setStatus('error')
      setError('Não foi possível iniciar a conversa por voz.')
    }
  }, [broadcast, closePeer, createOffer, createPeer, userId])

  const start = useCallback(async () => {
    if (streamRef.current) {
      setMuted(false)
      for (const track of streamRef.current.getAudioTracks()) track.enabled = true
      setStatus(peerRef.current?.connectionState === 'connected' ? 'connected' : 'ready')
      await broadcast({ kind: 'ready' })
      await createOffer()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Este navegador não oferece acesso seguro ao microfone.')
      return
    }
    setStatus('requesting')
    setError('')
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      setStatus('ready')
      setMuted(false)
      await broadcast({ kind: 'ready' })
      await createOffer()
    } catch {
      setStatus('error')
      setError('O microfone não foi permitido. Você ainda pode usar o chat.')
    }
  }, [broadcast, createOffer])

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return
    const next = !muted
    for (const track of streamRef.current.getAudioTracks()) track.enabled = !next
    setMuted(next)
  }, [muted])

  const stop = useCallback(() => {
    void broadcast({ kind: 'hangup' })
    closePeer()
    for (const track of streamRef.current?.getTracks() || []) track.stop()
    streamRef.current = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    setMuted(false)
    setStatus('off')
  }, [broadcast, closePeer])

  useEffect(() => stop, [stop])

  return { status, muted, error, start, stop, toggleMute, handleSignal }
}
