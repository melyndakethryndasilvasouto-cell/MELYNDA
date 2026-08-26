import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { LoaderCircle, MessageCircle, Mic, MicOff, PhoneOff, RotateCcw, Send, Volume2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import { usePlayer } from '../../contexts/PlayerContext'
import { cleanRoomMessage, OnlinePlayer, OnlineRoom } from '../../online/types'
import { useRoomVoice } from '../../online/useRoomVoice'
import { supabase } from '../../services/supabase'

interface RoomMessage {
  id: string
  senderId: string
  text: string
  createdAt: number
}

const EMPTY_ROOM_MESSAGES: RoomMessage[] = []

function roomError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (message.includes('NOT_YOUR_TURN')) return 'Agora é a vez do outro jogador.'
  if (message.includes('CELL_OCCUPIED')) return 'Essa casa já está ocupada.'
  if (message.includes('ROOM_NOT_ACTIVE')) return 'A partida ainda não está pronta ou já terminou.'
  return 'Não foi possível atualizar a partida. Tente novamente.'
}

export default function OnlineRoomPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const { playerName, playerAvatar } = usePlayer()
  const { status: onlineStatus, userId, connect } = useOnline()
  const [room, setRoom] = useState<OnlineRoom | null>(null)
  const [profiles, setProfiles] = useState<Record<string, OnlinePlayer>>({})
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [roomConnected, setRoomConnected] = useState(false)
  const [messages, setMessages] = useState<RoomMessage[]>(EMPTY_ROOM_MESSAGES)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState(false)
  const [voiceConsentOpen, setVoiceConsentOpen] = useState(false)
  const roomRef = useRef<OnlineRoom | null>(null)
  const voiceHandlerRef = useRef<(payload: unknown) => Promise<void>>(async () => {})
  const hostId = room?.host_id || ''
  const voice = useRoomVoice(channel, userId, hostId)
  roomRef.current = room
  voiceHandlerRef.current = voice.handleSignal as (payload: unknown) => Promise<void>

  useEffect(() => { void connect() }, [connect])

  useEffect(() => {
    if (!supabase || onlineStatus !== 'connected' || !userId || !roomId) return
    let active = true
    const load = async () => {
      setLoading(true)
      const result = await supabase.from('online_rooms').select('*').eq('id', roomId).single()
      if (!active) return
      if (result.error) {
        setError('Esta sala não existe ou não pertence a você.')
        setLoading(false)
        return
      }
      const loadedRoom = result.data as OnlineRoom
      setRoom(loadedRoom)
      const ids = [loadedRoom.host_id, loadedRoom.guest_id].filter(Boolean) as string[]
      const profileResult = await supabase.from('online_profiles').select('user_id,display_name,avatar').in('user_id', ids)
      if (active && !profileResult.error) {
        const next: Record<string, OnlinePlayer> = {}
        for (const profile of profileResult.data || []) next[profile.user_id] = { userId: profile.user_id, name: profile.display_name, avatar: profile.avatar }
        setProfiles(next)
      }
      setLoading(false)
    }
    void load()

    const roomChannel = supabase.channel(`online:room:${roomId}`, { config: { private: true, broadcast: { ack: true } } })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_rooms', filter: `id=eq.${roomId}` }, ({ new: next }) => {
        if (active) setRoom(next as unknown as OnlineRoom)
      })
      .on('broadcast', { event: 'room-chat' }, ({ payload }) => {
        const value = payload as { id?: string; text?: string; createdAt?: number }
        const text = cleanRoomMessage(value.text || '')
        if (!value.id || !text || !Number.isFinite(value.createdAt)) return
        const currentRoom = roomRef.current
        if (!currentRoom) return
        const remoteParticipantId = currentRoom.host_id === userId ? currentRoom.guest_id : currentRoom.host_id
        if (!remoteParticipantId) return
        setMessages(previous => [...previous.slice(-49), { id: value.id!, senderId: remoteParticipantId, text, createdAt: value.createdAt! }])
      })
      .on('broadcast', { event: 'voice-signal' }, ({ payload }) => {
        const currentRoom = roomRef.current
        if (!currentRoom) return
        const remoteParticipantId = currentRoom.host_id === userId ? currentRoom.guest_id : currentRoom.host_id
        if (!remoteParticipantId) return
        const signal = typeof payload === 'object' && payload ? payload as Record<string, unknown> : {}
        void voiceHandlerRef.current({ ...signal, senderId: remoteParticipantId })
      })
      .subscribe(subscriptionStatus => {
        if (subscriptionStatus === 'SUBSCRIBED') setRoomConnected(true)
        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          setRoomConnected(false)
          setError('A conexão privada da sala foi interrompida.')
        }
      })
    setChannel(roomChannel)

    return () => {
      active = false
      setRoomConnected(false)
      setChannel(null)
      void supabase.removeChannel(roomChannel)
    }
  }, [onlineStatus, roomId, userId])

  useEffect(() => {
    if (room?.status === 'cancelled') voice.stop()
  }, [room?.status, voice.stop])

  useEffect(() => {
    if (!supabase || !room?.guest_id || profiles[room.guest_id]) return
    void supabase.from('online_profiles').select('user_id,display_name,avatar').eq('user_id', room.guest_id).single()
      .then(({ data }) => {
        if (data) setProfiles(previous => ({ ...previous, [data.user_id]: { userId: data.user_id, name: data.display_name, avatar: data.avatar } }))
      })
  }, [profiles, room?.guest_id])

  const mySymbol = room?.host_id === userId ? 'X' : 'O'
  const opponentId = room ? (room.host_id === userId ? room.guest_id : room.host_id) : null
  const opponent = opponentId ? profiles[opponentId] : null
  const board = room?.state?.board || Array(9).fill(null)
  const result = room?.state?.result || 'playing'
  const myTurn = room?.status === 'active' && room.state.turn === mySymbol
  const statusText = useMemo(() => {
    if (!room) return 'Abrindo sala…'
    if (room.status === 'waiting') return 'Aguardando o outro jogador aceitar o convite…'
    if (room.status === 'cancelled') return 'Esta sala foi encerrada.'
    if (result === 'draw') return 'Empate! Vocês jogaram muito bem.'
    if (result === 'X' || result === 'O') return result === mySymbol ? 'Você venceu! 🎉' : `${opponent?.name || 'Seu amigo'} venceu!`
    return myTurn ? 'Sua vez!' : `Vez de ${opponent?.name || 'outro jogador'}…`
  }, [mySymbol, myTurn, opponent?.name, result, room])

  const play = async (cell: number) => {
    if (!supabase || moving || !myTurn || board[cell] !== null) return
    setMoving(true)
    setError('')
    const response = await supabase.rpc('play_online_ttt', { room: roomId, cell })
    if (response.error) setError(roomError(response.error))
    else setRoom(response.data as OnlineRoom)
    setMoving(false)
  }

  const restart = async () => {
    if (!supabase) return
    const response = await supabase.rpc('restart_online_ttt', { room: roomId })
    if (response.error) setError(roomError(response.error))
    else setRoom(response.data as OnlineRoom)
  }

  const leave = async () => {
    voice.stop()
    if (supabase) await supabase.rpc('leave_online_room', { room: roomId })
    navigate('/online')
  }

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const text = cleanRoomMessage(draft)
    if (!channel || !text || !userId) return
    const message = { id: crypto.randomUUID(), senderId: userId, text, createdAt: Date.now() }
    await channel.send({ type: 'broadcast', event: 'room-chat', payload: message })
    setMessages(previous => [...previous.slice(-49), message])
    setDraft('')
  }

  if (loading || onlineStatus === 'connecting') {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 font-bold" style={{ color: '#5B3A8A' }}><LoaderCircle className="animate-spin" /> Abrindo sala privada…</div>
  }

  if (!room) {
    return <section className="glass-card mt-8 p-6 text-center"><h1 className="font-title text-2xl" style={{ color: '#5B3A8A' }}>Sala indisponível</h1><p role="alert" className="mt-3 text-sm">{error}</p><button className="btn-primary mt-4" onClick={() => navigate('/online')}>Voltar ao Online</button></section>
  }

  return (
    <section className="pb-6 pt-3">
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#4A90D9' }}>Sala privada • Jogo online</p>
        <h1 className="mt-1 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogo da Velha</h1>
        <p className="mt-2 font-black" aria-live="polite" style={{ color: myTurn ? '#166534' : '#6B7280' }}>{statusText}</p>
      </header>

      <div className="glass-card mt-4 grid grid-cols-2 gap-3 p-3 text-center">
        <div className={mySymbol === 'X' ? 'rounded-2xl bg-blue-50 p-2' : 'p-2'}>
          <p className="text-2xl" aria-hidden="true">{playerAvatar}</p>
          <p className="truncate text-sm font-black">{playerName} ({mySymbol})</p>
        </div>
        <div className={mySymbol === 'O' ? 'rounded-2xl bg-purple-50 p-2' : 'p-2'}>
          <p className="text-2xl" aria-hidden="true">{opponent?.avatar || '⏳'}</p>
          <p className="truncate text-sm font-black">{opponent ? `${opponent.name} (${mySymbol === 'X' ? 'O' : 'X'})` : 'Aguardando…'}</p>
        </div>
      </div>

      <div className="mx-auto mt-5 grid w-full max-w-[340px] grid-cols-3 gap-3" aria-label="Tabuleiro do Jogo da Velha">
        {board.map((cell, index) => (
          <button key={index} type="button" onClick={() => void play(index)} disabled={!myTurn || moving || cell !== null}
            aria-label={cell ? `Casa ${index + 1}, marcada com ${cell}` : `Casa ${index + 1}, vazia`}
            className="flex aspect-square items-center justify-center rounded-3xl bg-white text-5xl font-black shadow-md transition-transform enabled:active:scale-90 disabled:cursor-default"
            style={{ color: cell === 'X' ? '#4A90D9' : '#7B5EA7', border: '2px solid rgba(196,181,253,.55)' }}>{cell}</button>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold" style={{ color: '#92400E' }}>{error}</p>}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {room.status === 'finished' && <button type="button" className="btn-primary text-sm" onClick={() => void restart()}><RotateCcw size={17} /> Revanche</button>}
        <button type="button" className="btn-secondary text-sm" onClick={() => void leave()}><PhoneOff size={17} /> Sair da sala</button>
      </div>

      <aside className="glass-card mt-5 p-4" aria-label="Chat e voz privados da partida">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-black" style={{ color: '#5B3A8A' }}><MessageCircle size={19} /> Conversa da partida</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>Somente você e o outro jogador recebem esta conversa.</p>
          </div>
          <div className="flex gap-2">
            {voice.status === 'off' || voice.status === 'error' ? (
              <button type="button" className="btn-primary px-3 text-xs" disabled={!roomConnected || !opponent} onClick={() => setVoiceConsentOpen(true)}><Mic size={17} /> Ativar voz</button>
            ) : (
              <>
                <button type="button" className="btn-secondary px-3 text-xs" onClick={voice.toggleMute}>{voice.muted ? <MicOff size={17} /> : <Mic size={17} />}{voice.muted ? 'Ativar' : 'Silenciar'}</button>
                <button type="button" className="btn-secondary px-3 text-xs" aria-label="Encerrar voz" onClick={voice.stop}><PhoneOff size={17} /></button>
              </>
            )}
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: voice.status === 'connected' ? '#166534' : '#6B7280' }}>
          <Volume2 size={14} aria-hidden="true" />
          {voice.status === 'off' ? 'Microfone desligado' : voice.status === 'requesting' ? 'Aguardando permissão do microfone…' : voice.status === 'connected' ? 'Voz conectada e criptografada' : voice.status === 'connecting' ? 'Conectando a voz…' : voice.status === 'ready' ? 'Aguardando o outro jogador ativar a voz…' : 'Voz indisponível'}
        </p>
        {voice.error && <p role="alert" className="mt-2 text-xs font-bold" style={{ color: '#92400E' }}>{voice.error}</p>}
        {voiceConsentOpen && (voice.status === 'off' || voice.status === 'error') && (
          <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3" role="group" aria-label="Confirmação para ativar o microfone">
            <p className="text-sm font-bold" style={{ color: '#1D4E89' }}>O navegador pedirá acesso ao microfone. Ative somente com um amigo conhecido e, se você for criança, com um adulto responsável por perto.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" onClick={() => { setVoiceConsentOpen(false); void voice.start() }}><Mic size={16} /> Entendi, ligar microfone</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setVoiceConsentOpen(false)}>Agora não</button>
            </div>
          </div>
        )}

        <div className="mt-3 max-h-48 min-h-24 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3" aria-live="polite">
          {messages.length === 0 ? <p className="text-center text-xs" style={{ color: '#6B7280' }}>Escreva uma mensagem gentil para seu amigo.</p> : messages.map(message => {
            const mine = message.senderId === userId
            const sender = mine ? { name: playerName, avatar: playerAvatar } : opponent || { name: 'Amigo', avatar: '👤' }
            return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><p className="max-w-[85%] rounded-2xl px-3 py-2 text-sm" style={{ background: mine ? '#DBEAFE' : '#F3E8FF' }}><strong>{sender.avatar} {sender.name}:</strong> {message.text}</p></div>
          })}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={sendMessage}>
          <label htmlFor="room-chat-message" className="sr-only">Mensagem para o outro jogador</label>
          <input id="room-chat-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={180}
            placeholder="Escreva com carinho…" className="min-w-0 flex-1 rounded-2xl border border-purple-200 bg-white px-3 text-sm" />
          <button type="submit" className="btn-primary h-11 w-11 p-0" aria-label="Enviar mensagem" disabled={!roomConnected || !cleanRoomMessage(draft) || !opponent}><Send size={18} /></button>
        </form>
        <p className="mt-2 text-xs font-bold" style={{ color: '#4B5563' }}>Converse somente com alguém que você conhece. Não compartilhe nome completo, endereço, escola, telefone ou senha. O site não grava o áudio e as mensagens da sala não ficam salvas. Se algo incomodar, saia da sala e conte a um adulto responsável.</p>
      </aside>
    </section>
  )
}
