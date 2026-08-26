import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gamepad2, LoaderCircle, MessageCircle, Radio, Send, ShieldCheck, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import { LOBBY_QUICK_MESSAGES } from '../../online/types'

export default function OnlineLobbyPage() {
  const navigate = useNavigate()
  const {
    configured, status, userId, players, invites, lobbyMessages, error,
    connect, sendLobbyMessage, invitePlayer, respondInvite,
  } = useOnline()
  const [busyPlayer, setBusyPlayer] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [safetyAccepted, setSafetyAccepted] = useState(status !== 'idle')

  const enterLobby = () => {
    setSafetyAccepted(true)
    void connect()
  }

  const invite = async (guestId: string) => {
    setBusyPlayer(guestId)
    try {
      const roomId = await invitePlayer(guestId)
      navigate(`/online/sala/${roomId}`)
    } catch {} finally {
      setBusyPlayer('')
    }
  }

  const answer = async (inviteId: string, accept: boolean) => {
    setBusyPlayer(inviteId)
    try {
      const roomId = await respondInvite(inviteId, accept)
      if (accept) navigate(`/online/sala/${roomId}`)
    } catch {} finally {
      setBusyPlayer('')
    }
  }

  if (!configured) {
    return (
      <section className="glass-card mx-auto mt-8 max-w-md p-6 text-center">
        <span className="text-5xl" aria-hidden="true">🌐</span>
        <h1 className="mt-3 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogos Online</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed" style={{ color: '#6B7280' }}>
          O modo online está sendo preparado. Os jogos locais continuam funcionando normalmente.
        </p>
      </section>
    )
  }

  if (!safetyAccepted) {
    return (
      <section className="glass-card mx-auto mt-8 max-w-md p-6 text-center">
        <ShieldCheck className="mx-auto" size={48} aria-hidden="true" style={{ color: '#047857' }} />
        <h1 className="mt-3 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogar com segurança</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed" style={{ color: '#4B5563' }}>
          Entre para jogar somente com um amigo que você conhece. Se você é criança, peça a um adulto responsável para acompanhar o convite, o chat e a voz.
        </p>
        <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm" style={{ color: '#1D4E89' }}>
          O microfone começa desligado e só é ativado quando você escolher dentro da partida.
        </p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={enterLobby}>Entendi, entrar no saguão</button>
      </section>
    )
  }

  const otherPlayers = players.filter(player => player.userId !== userId)

  return (
    <section className="pb-24 pt-4">
      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="text-5xl" aria-hidden="true">🌐</div>
        <h1 className="mt-2 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogadores Online</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-bold" style={{ color: '#4A90D9' }}>
          Encontre um amigo, envie um convite e joguem juntos de lugares diferentes.
        </p>
      </motion.header>

      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-black"
        style={{ color: status === 'connected' ? '#166534' : '#6B7280', background: status === 'connected' ? '#DCFCE7' : '#F3F4F6' }}>
        {status === 'connecting' ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Radio size={18} aria-hidden="true" />}
        {status === 'connected' ? `${players.length} jogador${players.length === 1 ? '' : 'es'} no saguão` : 'Conectando ao saguão…'}
      </div>

      {error && <p role="alert" className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold" style={{ color: '#92400E' }}>{error}</p>}

      {invites.length > 0 && (
        <section className="mt-5 space-y-3" aria-labelledby="invites-title">
          <h2 id="invites-title" className="font-black" style={{ color: '#5B3A8A' }}>Convites recebidos</h2>
          {invites.map(invite => (
            <article key={invite.id} className="glass-card p-4">
              <p className="font-black" style={{ color: '#374151' }}>
                <span aria-hidden="true">{invite.from_avatar}</span> {invite.from_name} convidou você
              </p>
              <p className="mt-1 text-sm" style={{ color: '#6B7280' }}>Jogo da Velha Online</p>
              <p className="mt-2 rounded-xl bg-yellow-50 p-2 text-xs font-bold" style={{ color: '#854D0E' }}>Aceite somente se você conhece essa pessoa.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn-primary text-sm" disabled={busyPlayer === invite.id}
                  onClick={() => void answer(invite.id, true)}>Aceitar</button>
                <button type="button" className="btn-secondary text-sm" disabled={busyPlayer === invite.id}
                  onClick={() => void answer(invite.id, false)}>Agora não</button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="mt-5" aria-labelledby="players-title">
        <div className="mb-3 flex items-center gap-2">
          <Users size={20} aria-hidden="true" style={{ color: '#5B3A8A' }} />
          <h2 id="players-title" className="font-black" style={{ color: '#5B3A8A' }}>Quem está aqui</h2>
        </div>
        {status !== 'connected' ? (
          <div className="glass-card p-6 text-center text-sm font-bold" style={{ color: '#6B7280' }}>Preparando a lista de jogadores…</div>
        ) : otherPlayers.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="text-4xl" aria-hidden="true">🕊️</p>
            <p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Você é o primeiro no saguão.</p>
            <p className="mt-1 text-sm" style={{ color: '#6B7280' }}>Peça a um amigo para abrir este site e entrar em Online.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {otherPlayers.map(player => (
              <article key={player.userId} className="glass-card flex items-center gap-3 p-3">
                <span className="text-3xl" aria-hidden="true">{player.avatar}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black" style={{ color: '#374151' }}>{player.name}</p>
                  <p className="text-xs font-bold" style={{ color: '#16A34A' }}>● online agora</p>
                </div>
                <button type="button" className="btn-primary px-3 text-sm" style={{ minHeight: 44 }}
                  disabled={Boolean(busyPlayer)} onClick={() => void invite(player.userId)}>
                  <Gamepad2 size={17} aria-hidden="true" />
                  {busyPlayer === player.userId ? 'Enviando…' : 'Convidar'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <button type="button" onClick={() => setChatOpen(value => !value)} aria-expanded={chatOpen}
        aria-controls="online-lobby-chat" className="fixed bottom-4 right-4 z-40 flex h-14 items-center gap-2 rounded-full px-5 font-black text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg,#6BB8FF,#A78BFA)' }}>
        <MessageCircle size={22} aria-hidden="true" /> Chat
      </button>

      {chatOpen && (
        <aside id="online-lobby-chat" className="fixed bottom-20 right-3 z-40 flex max-h-[70vh] w-[min(360px,calc(100vw-24px))] flex-col rounded-3xl border border-purple-100 bg-white p-4 shadow-2xl"
          aria-label="Chat do saguão online">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black" style={{ color: '#5B3A8A' }}>Chat do saguão</h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>Mensagens rápidas e seguras</p>
            </div>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50" aria-label="Fechar chat" onClick={() => setChatOpen(false)}><X size={20} /></button>
          </div>
          <div className="mt-3 min-h-24 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3" aria-live="polite">
            {lobbyMessages.length === 0 ? <p className="text-center text-xs" style={{ color: '#6B7280' }}>Escolha uma mensagem para cumprimentar o pessoal.</p> : lobbyMessages.map(message => (
              <p key={message.id} className="text-sm"><strong>{message.avatar} {message.name}:</strong> {message.text}</p>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            {LOBBY_QUICK_MESSAGES.map((message, index) => (
              <button key={message} type="button" className="flex min-h-11 items-center justify-between rounded-2xl bg-blue-50 px-3 text-left text-xs font-bold" style={{ color: '#1D4ED8' }}
                disabled={status !== 'connected'} onClick={() => void sendLobbyMessage(index)}>{message}<Send size={14} aria-hidden="true" /></button>
            ))}
          </div>
        </aside>
      )}
    </section>
  )
}
