import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { AlertTriangle, Ban, LoaderCircle, MessageCircle, Mic, MicOff, PhoneOff, RotateCcw, Send, Volume2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import { usePlayer } from '../../contexts/PlayerContext'
import { cleanRoomMessage, OnlineChatMessage, OnlinePlayer, OnlineRoom } from '../../online/types'
import type { EphemeralAudioBroadcastPayload } from '../../online/useEphemeralAudioMessage'
import { useRoomVoice } from '../../online/useRoomVoice'
import { supabase } from '../../services/supabase'
import AudioMessageComposer from './AudioMessageComposer'
import OnlineSafetyGate from './OnlineSafetyGate'
import OnlineTicTacToeBoard from './OnlineTicTacToeBoard'
import OnlineMemoryBoard from './OnlineMemoryBoard'
import OnlineCheckersBoard from './OnlineCheckersBoard'
import OnlineQuizBoard from './OnlineQuizBoard'
import OnlineUnoBoard from './OnlineUnoBoard'

const EMPTY_ROOM_MESSAGES: OnlineChatMessage[] = []

function roomError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (message.includes('NOT_YOUR_TURN')) return 'Agora Ã© a vez do outro jogador.'
  if (message.includes('CELL_OCCUPIED')) return 'Essa casa jÃ¡ estÃ¡ ocupada.'
  if (message.includes('ROOM_NOT_ACTIVE')) return 'A partida ainda nÃ£o estÃ¡ pronta ou jÃ¡ terminou.'
  if (message.includes('MESSAGE_PERSONAL_DATA')) return 'Essa mensagem pode mostrar informaÃ§Ã£o pessoal. Escreva de outro jeito.'
  if (message.includes('MESSAGE_UNSAFE')) return 'Essa mensagem nÃ£o parece segura para um chat infantil.'
  if (message.includes('MESSAGE_RATE_LIMIT')) return 'Espere um pouquinho antes de enviar outra mensagem.'
  return 'NÃ£o foi possÃ­vel atualizar a partida. Tente novamente.'
}

export default function OnlineRoomPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const { playerName, playerAvatar } = usePlayer()
  const { safetyAccepted, status: onlineStatus, userId, acceptSafety, connect, blockPlayer, reportPlayer } = useOnline()
  const [room, setRoom] = useState<OnlineRoom | null>(null)
  const [profiles, setProfiles] = useState<Record<string, OnlinePlayer>>({})
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [roomConnected, setRoomConnected] = useState(false)
  const [messages, setMessages] = useState<OnlineChatMessage[]>(EMPTY_ROOM_MESSAGES)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState(false)
  const [voiceConsentOpen, setVoiceConsentOpen] = useState(false)
  // Multi-game broadcast state
  const [broadcastGameState, setBroadcastGameState] = useState<unknown>(null)
  const [guestMove, setGuestMove] = useState<unknown>(null)
  const roomRef = useRef<OnlineRoom | null>(null)
  const voiceHandlerRef = useRef<(payload: unknown) => Promise<void>>(async () => {})
  const messageLogRef = useRef<HTMLDivElement>(null)
  const keepAtBottomRef = useRef(true)
  const [newMessages, setNewMessages] = useState(false)
  const hostId = room?.host_id || ''
  const isHost = hostId === userId && hostId !== ''
  const voice = useRoomVoice(channel, userId, hostId)
  roomRef.current = room
  voiceHandlerRef.current = voice.handleSignal as (payload: unknown) => Promise<void>

  useEffect(() => { if (safetyAccepted) void connect() }, [connect, safetyAccepted])

  useEffect(() => {
    if (!supabase || onlineStatus !== 'connected' || !userId || !roomId) return
    let active = true
    const load = async () => {
      setLoading(true)
      const result = await supabase.from('online_rooms').select('*').eq('id', roomId).single()
      if (!active) return
      if (result.error) {
        setError('Esta sala nÃ£o existe ou nÃ£o pertence a vocÃª.')
        setLoading(false)
        return
      }
      const loadedRoom = result.data as OnlineRoom
      setRoom(loadedRoom)
      const ids = [loadedRoom.host_id, loadedRoom.guest_id].filter(Boolean) as string[]
      const profileResult = await supabase.from('online_profiles').select('user_id,display_name,avatar').in('user_id', ids)
      if (active && !profileResult.error) {
        const next: Record<string, OnlinePlayer> = {}
        for (const profile of profileResult.data || []) next[profile.user_id] = {
          userId: profile.user_id,
          name: profile.display_name,
          avatar: profile.avatar,
          activity: 'playing',
          gameKey: 'tic-tac-toe',
          updatedAt: new Date().toISOString(),
        }
        setProfiles(next)
      }
      const messageResult = await supabase.from('online_room_messages').select('*').eq('room_id', roomId)
        .gt('expires_at', new Date().toISOString()).order('created_at').limit(100)
      if (active && !messageResult.error) setMessages((messageResult.data || []) as OnlineChatMessage[])
      setLoading(false)
    }
    void load()

    const roomChannel = supabase.channel(`online:room:${roomId}`, { config: { private: true, broadcast: { ack: true } } })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_rooms', filter: `id=eq.${roomId}` }, ({ new: next }) => {
        if (active) setRoom(next as unknown as OnlineRoom)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'online_room_messages', filter: `room_id=eq.${roomId}` }, ({ new: next }) => {
        const message = next as unknown as OnlineChatMessage
        if (active && message.id) setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous.slice(-99), message])
      })
      .on('broadcast', { event: 'voice-signal' }, ({ payload }) => {
        const currentRoom = roomRef.current
        if (!currentRoom) return
        const remoteParticipantId = currentRoom.host_id === userId ? currentRoom.guest_id : currentRoom.host_id
        if (!remoteParticipantId) return
        const signal = typeof payload === 'object' && payload ? payload as Record<string, unknown> : {}
        void voiceHandlerRef.current({ ...signal, senderId: remoteParticipantId })
      })
      .on('broadcast', { event: 'game-state' }, ({ payload }) => {
        if (!active) return
        const currentRoom = roomRef.current
        // Only the guest applies the host's broadcast state
        if (currentRoom && currentRoom.host_id !== userId) {
          setBroadcastGameState((payload as Record<string, unknown>).gameState ?? null)
        }
      })
      .on('broadcast', { event: 'game-move' }, ({ payload }) => {
        if (!active) return
        const currentRoom = roomRef.current
        // Only the host processes guest move requests
        if (currentRoom && currentRoom.host_id === userId) {
          setGuestMove((payload as Record<string, unknown>).move ?? null)
        }
      })
      .on('broadcast', { event: 'game-restart' }, () => {
        if (!active) return
        setBroadcastGameState(null)
        setGuestMove(null)
      })
      .subscribe(subscriptionStatus => {
        if (subscriptionStatus === 'SUBSCRIBED') setRoomConnected(true)
        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          setRoomConnected(false)
          setError('A conexÃ£o privada da sala foi interrompida.')
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
        if (data) setProfiles(previous => ({
          ...previous,
          [data.user_id]: { userId: data.user_id, name: data.display_name, avatar: data.avatar, activity: 'playing', gameKey: 'tic-tac-toe', updatedAt: new Date().toISOString() },
        }))
      })
  }, [profiles, room?.guest_id])

  const mySymbol = room?.host_id === userId ? 'X' : 'O'
  const opponentId = room ? (room.host_id === userId ? room.guest_id : room.host_id) : null
  const opponent = opponentId ? profiles[opponentId] : null
  // TTT-specific state â€” cast safely since non-TTT games don't use these
  
  
  
  
  

  const scrollMessagesToEnd = useCallback(() => {
    const log = messageLogRef.current
    if (!log) return
    log.scrollTo({ top: log.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    keepAtBottomRef.current = true
    setNewMessages(false)
  }, [])

  useEffect(() => {
    if (keepAtBottomRef.current) window.requestAnimationFrame(scrollMessagesToEnd)
    else if (messages.length) setNewMessages(true)
  }, [messages.length, scrollMessagesToEnd])

  const restart = async () => {
    if (!supabase) return
    channel?.send({ type: 'broadcast', event: 'game-restart', payload: {} })
    const response = await supabase.rpc('restart_online_room', { room: roomId })
    if (response.error) setError(roomError(response.error))
    else { setBroadcastGameState(null); setGuestMove(null); setRoom(response.data as OnlineRoom) }
  }

  // Broadcast helpers used by non-TTT game components
  const broadcastState = useCallback((gameState: unknown) => {
    channel?.send({ type: 'broadcast', event: 'game-state', payload: { gameState } })
  }, [channel])

  const broadcastMove = useCallback((move: unknown) => {
    channel?.send({ type: 'broadcast', event: 'game-move', payload: { move } })
  }, [channel])

  const finishRoom = useCallback(async (winner: 'host' | 'guest' | 'draw') => {
    if (!supabase) return
    await supabase.rpc('finish_online_room', { room: roomId, winner })
  }, [roomId])

  const leave = async (confirmed = false) => {
    if (!confirmed && !window.confirm('Sair desta partida e voltar para a lista Online?')) return
    voice.stop()
    if (supabase) await supabase.rpc('leave_online_room', { room: roomId })
    navigate('/online')
  }

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const text = cleanRoomMessage(draft)
    if (!supabase || !text || !userId) return
    const response = await supabase.rpc('send_online_room_message', { target_room: roomId, message_text: text })
    if (response.error) setError(roomError(response.error))
    else {
      const message = response.data as OnlineChatMessage
      setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous.slice(-99), message])
      setDraft('')
    }
  }

  const sendAudio = useCallback(async (payload: EphemeralAudioBroadcastPayload) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    const response = await supabase.rpc('send_online_room_audio', {
      target_room: roomId,
      audio_value: `data:${payload.mimeType};base64,${payload.dataBase64}`,
      mime_value: payload.mimeType,
      duration_value: payload.durationMs,
    })
    if (response.error) throw new Error(roomError(response.error))
    const message = response.data as OnlineChatMessage
    setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous.slice(-99), message])
  }, [roomId])

  const protectFromOpponent = async (report = false) => {
    if (!opponentId) return
    const action = report ? 'denunciar e bloquear' : 'bloquear'
    if (!window.confirm(`Deseja mesmo ${action} ${opponent?.name || 'este jogador'} e sair da sala?`)) return
    try {
      if (report) await reportPlayer(opponentId, 'other', 'room')
      await blockPlayer(opponentId)
      setError(report ? 'DenÃºncia recebida. O jogador foi bloqueado.' : 'Jogador bloqueado.')
      await leave(true)
    } catch (protectError) {
      setError(protectError instanceof Error ? protectError.message : 'NÃ£o foi possÃ­vel concluir essa proteÃ§Ã£o.')
    }
  }

  if (!safetyAccepted) return <OnlineSafetyGate onAccept={() => { acceptSafety(); void connect() }} notice={error} />

  if (loading || onlineStatus === 'connecting') {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 font-bold" style={{ color: '#5B3A8A' }}><LoaderCircle className="animate-spin" /> Abrindo sala privadaâ€¦</div>
  }

  if (!room) {
    return <section className="glass-card mt-8 p-6 text-center"><h1 className="font-title text-2xl" style={{ color: '#5B3A8A' }}>Sala indisponÃ­vel</h1><p role="alert" className="mt-3 text-sm">{error}</p><button className="btn-primary mt-4" onClick={() => navigate('/online')}>Voltar ao Online</button></section>
  }

  return (
    <section className="pb-6 pt-3">
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#1D4E89' }}>Sala privada â€¢ Jogo online</p>
        <h1 className="mt-1 font-title text-3xl" style={{ color: '#5B3A8A' }}>
          {room.game === 'memory' ? 'ðŸ•Šï¸ MemÃ³ria da BÃ­blia'
            : room.game === 'checkers' ? 'ðŸ›¡ï¸ Dama'
            : room.game === 'quiz' ? 'ðŸ“– Quiz da BÃ­blia'
            : room.game === 'pong' ? 'ðŸŽ¯ Ping Pong'
            : 'ðŸ›¤ï¸ Jogo da Velha'}
        </h1>
        
      </header>

      <div className="glass-card mt-4 grid grid-cols-2 gap-3 p-3 text-center">
        <div className={isHost ? 'rounded-2xl bg-blue-50 p-2' : 'p-2'}>
          <p className="text-2xl" aria-hidden="true">{playerAvatar}</p>
          <p className="truncate text-sm font-black">{playerName} {room.game === 'tic-tac-toe' ? `(${mySymbol})` : isHost ? 'ðŸ‘‘' : ''}</p>
        </div>
        <div className={!isHost ? 'rounded-2xl bg-purple-50 p-2' : 'p-2'}>
          <p className="text-2xl" aria-hidden="true">{opponent?.avatar || 'â³'}</p>
          <p className="truncate text-sm font-black">
            {opponent ? `${opponent.name} ${room.game === 'tic-tac-toe' ? `(${mySymbol === 'X' ? 'O' : 'X'})` : ''}` : 'Aguardandoâ€¦'}
          </p>
        </div>
      </div>

      {/* â”€â”€ TicTacToe board â”€â”€ */}
      {(room.game === 'tic-tac-toe' || !room.game) && (
          <OnlineTicTacToeBoard
            isHost={isHost}
            roomStatus={room.status}
            opponent={opponent}
            broadcastGameState={broadcastGameState}
            guestMove={guestMove}
            onBroadcastState={broadcastState}
            onBroadcastMove={broadcastMove}
            onFinish={finishRoom}
          />
        )}

      {/* â”€â”€ Memory online board â”€â”€ */}
      {room.game === 'memory' && (
        <OnlineMemoryBoard
          isHost={isHost}
          roomStatus={room.status}
          opponent={opponent}
          broadcastGameState={broadcastGameState}
          guestMove={guestMove}
          onBroadcastState={broadcastState}
          onBroadcastMove={broadcastMove}
          onFinish={finishRoom}
        />
      )}

      {/* â”€â”€ Checkers online board â”€â”€ */}
      {room.game === 'checkers' && (
        <OnlineCheckersBoard
          isHost={isHost}
          roomStatus={room.status}
          opponent={opponent}
          broadcastGameState={broadcastGameState}
          guestMove={guestMove}
          onBroadcastState={broadcastState}
          onBroadcastMove={broadcastMove}
          onFinish={finishRoom}
        />
      )}

      {/* â”€â”€ Quiz online board â”€â”€ */}
      {room.game === 'quiz' && (
        <OnlineQuizBoard
          isHost={isHost}
          roomStatus={room.status}
          opponent={opponent}
          broadcastGameState={broadcastGameState}
          guestMove={guestMove}
          onBroadcastState={broadcastState}
          onBroadcastMove={broadcastMove}
          onFinish={finishRoom}
        />
      )}

      {error && <p role="alert" className="mt-3 rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold" style={{ color: '#92400E' }}>{error}</p>}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {room.status === 'finished' && <button type="button" className="btn-primary text-sm" onClick={() => void restart()}><RotateCcw size={17} /> Revanche</button>}
        <button type="button" className="btn-secondary text-sm" onClick={() => void leave()}><PhoneOff size={17} /> Sair da sala</button>
      </div>

      <aside className="glass-card mt-5 p-4" aria-label="Chat e voz privados da partida">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-black" style={{ color: '#5B3A8A' }}><MessageCircle size={19} /> Conversa da partida</h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>Somente vocÃª e o outro jogador recebem esta conversa.</p>
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
        <p className="mt-2 flex items-center gap-1 text-xs font-bold" role="status" aria-live="polite" style={{ color: voice.status === 'connected' ? '#166534' : '#4B5563' }}>
          <Volume2 size={14} aria-hidden="true" />
          {voice.status === 'off' ? 'Chamada ao vivo desligada' : voice.status === 'requesting' ? 'Aguardando permissÃ£o do microfoneâ€¦' : voice.status === 'connected' ? 'Voz ao vivo conectada' : voice.status === 'connecting' ? 'Conectando a vozâ€¦' : voice.status === 'ready' ? 'Aguardando o outro jogador ativar a vozâ€¦' : 'Voz indisponÃ­vel'}
        </p>
        {voice.error && <p role="alert" className="mt-2 text-xs font-bold" style={{ color: '#92400E' }}>{voice.error}</p>}
        {voiceConsentOpen && (voice.status === 'off' || voice.status === 'error') && (
          <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3" role="group" aria-label="ConfirmaÃ§Ã£o para ativar o microfone">
            <p className="text-sm font-bold" style={{ color: '#1D4E89' }}>O navegador pedirÃ¡ acesso ao microfone para uma chamada direta. Ative somente com um amigo conhecido e um adulto responsÃ¡vel por perto. Para mais privacidade, prefira a mensagem de Ã¡udio curta.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" onClick={() => { setVoiceConsentOpen(false); void voice.start() }}><Mic size={16} /> Entendi, ligar microfone</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setVoiceConsentOpen(false)}>Agora nÃ£o</button>
            </div>
          </div>
        )}

        <div ref={messageLogRef} onScroll={event => { const log = event.currentTarget; keepAtBottomRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80; if (keepAtBottomRef.current) setNewMessages(false) }} className="mt-3 max-h-48 min-h-24 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3" role="log" aria-live="polite" aria-label="Mensagens privadas da partida">
          {messages.length === 0 ? <p className="text-center text-xs" style={{ color: '#6B7280' }}>Escreva ou grave uma mensagem gentil para seu amigo.</p> : messages.map(message => {
            const mine = message.sender_id === userId
            const sender = mine ? { name: playerName, avatar: playerAvatar } : opponent || { name: 'Amigo', avatar: 'ðŸ‘¤' }
            return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm" style={{ background: mine ? '#DBEAFE' : '#F3E8FF', overflowWrap: 'anywhere' }}><strong className="block">{sender.avatar} {sender.name}</strong>{message.kind === 'text' ? <p>{message.body}</p> : <audio controls preload="none" src={message.audio_data || ''} className="mt-2 max-w-full" aria-label={`Ãudio de ${sender.name}`} />}</div></div>
          })}
        </div>
        {newMessages && <button type="button" className="mx-auto mt-2 flex min-h-11 items-center rounded-full bg-blue-700 px-4 text-sm font-black text-white" onClick={scrollMessagesToEnd}>Novas mensagens â†“</button>}
        <form className="mt-3 flex gap-2" onSubmit={sendMessage}>
          <label htmlFor="room-chat-message" className="sr-only">Mensagem para o outro jogador</label>
          <input id="room-chat-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={180}
            placeholder="Escreva com carinhoâ€¦" className="min-w-0 flex-1 rounded-2xl border border-purple-200 bg-white px-3 text-sm" />
          <button type="submit" className="btn-primary h-11 w-11 p-0" aria-label="Enviar mensagem" disabled={!roomConnected || !cleanRoomMessage(draft) || !opponent}><Send size={18} /></button>
        </form>
        <AudioMessageComposer disabled={!roomConnected || !opponent} onSend={sendAudio} />
        {opponentId && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className="min-h-11 rounded-2xl bg-slate-100 px-3 text-sm font-bold" onClick={() => void protectFromOpponent()}><Ban className="inline" size={16} /> Bloquear</button><button type="button" className="min-h-11 rounded-2xl bg-orange-50 px-3 text-sm font-bold" style={{ color: '#9A3412' }} onClick={() => void protectFromOpponent(true)}><AlertTriangle className="inline" size={16} /> Denunciar</button></div>}
        <p className="mt-2 text-xs font-bold" style={{ color: '#4B5563' }}>Converse somente com alguÃ©m conhecido. NÃ£o compartilhe nome completo, endereÃ§o, escola, telefone, senha ou fotos. Texto e Ã¡udio curto deixam de ficar disponÃ­veis apÃ³s 24 horas; a outra pessoa ainda pode gravar por fora do site. Se algo incomodar, bloqueie, saia e conte a um adulto responsÃ¡vel.</p>
      </aside>
    </section>
  )
}

