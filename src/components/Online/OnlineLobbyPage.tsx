import { FormEvent, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  Gamepad2,
  LoaderCircle,
  MessageCircle,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import { activityLabel } from '../../online/gameRegistry'
import { LOBBY_QUICK_MESSAGES, OnlinePlayer } from '../../online/types'

export default function OnlineLobbyPage() {
  const navigate = useNavigate()
  const {
    configured, status, userId, players, invites, groupInvites, groups, lobbyMessages, error,
    connect, sendLobbyMessage, invitePlayer, respondInvite, createGroup, inviteToGroup,
    respondGroupInvite, blockPlayer, reportPlayer,
  } = useOnline()
  const [busy, setBusy] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [safetyAccepted, setSafetyAccepted] = useState(status !== 'idle' || localStorage.getItem('mel-online-consent') === 'yes')
  const [selectedPlayer, setSelectedPlayer] = useState<OnlinePlayer | null>(null)
  const [groupName, setGroupName] = useState('Turma da Bíblia')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [notice, setNotice] = useState('')

  const ownedGroups = useMemo(() => groups.filter(group => group.owner_id === userId), [groups, userId])

  const enterLobby = () => {
    setSafetyAccepted(true)
    localStorage.setItem('mel-online-consent', 'yes')
    void connect()
  }

  const invite = async (player: OnlinePlayer) => {
    setBusy(player.userId)
    setNotice('')
    try {
      const roomId = await invitePlayer(player.userId)
      navigate(`/online/sala/${roomId}`)
    } catch (inviteError) {
      setNotice(inviteError instanceof Error ? inviteError.message : 'Não foi possível enviar o convite.')
    } finally {
      setBusy('')
    }
  }

  const answer = async (inviteId: string, accept: boolean) => {
    setBusy(inviteId)
    try {
      const roomId = await respondInvite(inviteId, accept)
      if (accept) navigate(`/online/sala/${roomId}`)
    } catch (answerError) {
      setNotice(answerError instanceof Error ? answerError.message : 'Não foi possível responder.')
    } finally {
      setBusy('')
    }
  }

  const answerGroup = async (inviteId: string, accept: boolean) => {
    setBusy(inviteId)
    try {
      const groupId = await respondGroupInvite(inviteId, accept)
      if (accept) navigate(`/online/grupo/${groupId}`)
    } catch (answerError) {
      setNotice(answerError instanceof Error ? answerError.message : 'Não foi possível responder.')
    } finally {
      setBusy('')
    }
  }

  const makeGroup = async (event: FormEvent, inviteAfter?: OnlinePlayer) => {
    event.preventDefault()
    if (groupName.trim().length < 2) return
    setBusy('new-group')
    try {
      const groupId = await createGroup(groupName.trim())
      if (inviteAfter) await inviteToGroup(groupId, inviteAfter.userId)
      setCreatingGroup(false)
      setSelectedPlayer(null)
      navigate(`/online/grupo/${groupId}`)
    } catch (groupError) {
      setNotice(groupError instanceof Error ? groupError.message : 'Não foi possível criar o grupo.')
    } finally {
      setBusy('')
    }
  }

  const inviteGroup = async (groupId: string, player: OnlinePlayer) => {
    setBusy(`group-${player.userId}`)
    try {
      await inviteToGroup(groupId, player.userId)
      setNotice(`Convite para o grupo enviado a ${player.name}.`)
      setSelectedPlayer(null)
    } catch (groupError) {
      setNotice(groupError instanceof Error ? groupError.message : 'Não foi possível convidar.')
    } finally {
      setBusy('')
    }
  }

  const protectFromPlayer = async (player: OnlinePlayer, report = false) => {
    setBusy(`safe-${player.userId}`)
    try {
      if (report) await reportPlayer(player.userId, 'other', 'lobby')
      await blockPlayer(player.userId)
      setSelectedPlayer(null)
      setNotice(report ? 'Denúncia recebida. Esse jogador também foi bloqueado.' : 'Jogador bloqueado. Ele não poderá convidar nem aparecer para você.')
    } catch (safeError) {
      setNotice(safeError instanceof Error ? safeError.message : 'Não foi possível concluir essa proteção.')
    } finally {
      setBusy('')
    }
  }

  if (!configured) {
    return <section className="glass-card mx-auto mt-8 max-w-md p-6 text-center"><span className="text-5xl" aria-hidden="true">🌐</span><h1 className="mt-3 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogos Online</h1><p className="mt-3 text-sm font-bold" style={{ color: '#6B7280' }}>O modo Online ainda precisa ser configurado.</p></section>
  }

  if (!safetyAccepted) {
    return (
      <section className="glass-card mx-auto mt-8 max-w-md p-6 text-center">
        <ShieldCheck className="mx-auto" size={48} aria-hidden="true" style={{ color: '#047857' }} />
        <h1 className="mt-3 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogar com segurança</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed" style={{ color: '#4B5563' }}>Use um apelido e aceite convites somente de amigos conhecidos. Se você é criança, peça para um adulto acompanhar o chat, os grupos e o áudio.</p>
        <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm" style={{ color: '#1D4E89' }}>Nunca compartilhe nome completo, escola, endereço, telefone, senha ou fotos.</p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={enterLobby}>Entendi, entrar no Online</button>
      </section>
    )
  }

  const otherPlayers = players.filter(player => player.userId !== userId)

  return (
    <section className="pb-28 pt-4">
      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="text-5xl" aria-hidden="true">🌐</div>
        <h1 className="mt-2 font-title text-3xl" style={{ color: '#5B3A8A' }}>Amigos Online</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-bold" style={{ color: '#2563A6' }}>Veja o apelido e o jogo de cada pessoa, convide para jogar ou conversem em um grupo privado.</p>
      </motion.header>

      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-black" style={{ color: status === 'connected' ? '#166534' : '#6B7280', background: status === 'connected' ? '#DCFCE7' : '#F3F4F6' }}>
        {status === 'connecting' ? <LoaderCircle className="animate-spin" size={18} /> : <Radio size={18} />}
        {status === 'connected' ? `${otherPlayers.length} amigo${otherPlayers.length === 1 ? '' : 's'} disponíve${otherPlayers.length === 1 ? 'l' : 'is'}` : 'Conectando com segurança…'}
      </div>

      {(error || notice) && <p role="status" className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold" style={{ color: '#92400E' }}>{notice || error}</p>}

      {(invites.length > 0 || groupInvites.length > 0) && (
        <section className="mt-5 space-y-3" aria-labelledby="invites-title">
          <h2 id="invites-title" className="font-black" style={{ color: '#5B3A8A' }}>Convites recebidos</h2>
          {invites.map(invite => (
            <article key={invite.id} className="glass-card p-4">
              <p className="font-black"><span aria-hidden="true">{invite.from_avatar}</span> {invite.from_name} quer jogar Jogo da Velha.</p>
              <p className="mt-2 rounded-xl bg-yellow-50 p-2 text-xs font-bold" style={{ color: '#854D0E' }}>Aceite somente se você conhece essa pessoa. Se estiver em outro jogo, ele será encerrado somente depois da sua confirmação.</p>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className="btn-primary text-sm" disabled={busy === invite.id} onClick={() => void answer(invite.id, true)}>Jogar agora</button><button type="button" className="btn-secondary text-sm" disabled={busy === invite.id} onClick={() => void answer(invite.id, false)}>Continuar aqui</button></div>
            </article>
          ))}
          {groupInvites.map(invite => (
            <article key={invite.id} className="glass-card p-4">
              <p className="font-black"><span aria-hidden="true">{invite.from_avatar}</span> {invite.from_name} convidou você para o grupo “{invite.group_name}”.</p>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className="btn-primary text-sm" disabled={busy === invite.id} onClick={() => void answerGroup(invite.id, true)}>Entrar no grupo</button><button type="button" className="btn-secondary text-sm" disabled={busy === invite.id} onClick={() => void answerGroup(invite.id, false)}>Agora não</button></div>
            </article>
          ))}
        </section>
      )}

      <section className="mt-5" aria-labelledby="groups-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Users size={20} style={{ color: '#5B3A8A' }} /><h2 id="groups-title" className="font-black" style={{ color: '#5B3A8A' }}>Meus grupos privados</h2></div><button type="button" className="btn-secondary min-h-11 px-3 text-sm" onClick={() => setCreatingGroup(value => !value)}><Plus size={17} /> Criar grupo</button></div>
        {creatingGroup && <form onSubmit={event => void makeGroup(event)} className="glass-card mb-3 flex flex-col gap-2 p-4 sm:flex-row"><label className="min-w-0 flex-1 text-sm font-bold">Nome do grupo<input value={groupName} onChange={event => setGroupName(event.target.value.slice(0, 32))} maxLength={32} className="mt-1 min-h-11 w-full rounded-2xl border border-purple-200 px-3" /></label><button type="submit" className="btn-primary self-end text-sm" disabled={busy === 'new-group' || groupName.trim().length < 2}>Criar</button></form>}
        {groups.length ? <div className="grid gap-3 sm:grid-cols-2">{groups.map(group => <button key={group.id} type="button" onClick={() => navigate(`/online/grupo/${group.id}`)} className="glass-card min-h-20 p-4 text-left"><strong className="block" style={{ color: '#5B3A8A' }}>👥 {group.name}</strong><span className="mt-1 block text-xs" style={{ color: '#4B5563' }}>{group.owner_id === userId ? 'Você é o dono e controla os convites.' : 'Grupo fechado por convite.'}</span></button>)}</div> : <p className="glass-card p-4 text-center text-sm" style={{ color: '#6B7280' }}>Crie um grupo ou espere um convite de um amigo.</p>}
      </section>

      <section className="mt-5" aria-labelledby="players-title">
        <div className="mb-3 flex items-center gap-2"><Gamepad2 size={20} style={{ color: '#5B3A8A' }} /><h2 id="players-title" className="font-black" style={{ color: '#5B3A8A' }}>Quem está Online</h2></div>
        {status !== 'connected' ? <div className="glass-card p-6 text-center text-sm font-bold">Preparando a lista…</div> : otherPlayers.length === 0 ? <div className="glass-card p-6 text-center"><p className="text-4xl">🕊️</p><p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Nenhum outro amigo apareceu agora.</p></div> : <div className="space-y-3">{otherPlayers.map(player => (
          <button key={player.userId} type="button" className="glass-card flex min-h-20 w-full items-center gap-3 p-3 text-left" onClick={() => setSelectedPlayer(player)}>
            <span className="text-3xl" aria-hidden="true">{player.avatar}</span><span className="min-w-0 flex-1"><strong className="block truncate">{player.name}</strong><span className="mt-1 block text-xs font-bold" style={{ color: player.activity === 'playing' ? '#1D4ED8' : '#15803D' }}>● {activityLabel(player)}</span></span><span className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-black" style={{ color: '#5B3A8A' }}>Opções</span>
          </button>
        ))}</div>}
      </section>

      <button type="button" onClick={() => setChatOpen(value => !value)} aria-expanded={chatOpen} aria-controls="online-lobby-chat" className="fixed bottom-4 right-4 z-40 flex h-14 items-center gap-2 rounded-full px-5 font-black text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#2563EB,#6D28D9)' }}><MessageCircle size={22} /> Chat geral</button>

      {chatOpen && <aside id="online-lobby-chat" className="fixed bottom-20 right-3 z-40 flex max-h-[72dvh] w-[min(380px,calc(100vw-24px))] flex-col rounded-3xl border border-purple-100 bg-white p-4 shadow-2xl" aria-label="Chat geral seguro">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-black" style={{ color: '#5B3A8A' }}>Chat geral</h2><p className="text-xs" style={{ color: '#4B5563' }}>Frases aprovadas para proteger as crianças</p></div><button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50" aria-label="Fechar chat" onClick={() => setChatOpen(false)}><X size={20} /></button></div>
        <div className="mt-3 min-h-24 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3" aria-live="polite">{lobbyMessages.length === 0 ? <p className="text-center text-xs">Escolha uma frase para cumprimentar o pessoal.</p> : lobbyMessages.map(message => <p key={message.id} className="text-sm"><strong>{message.avatar} {message.name}:</strong> {message.text}</p>)}</div>
        <div className="mt-3 grid gap-2">{LOBBY_QUICK_MESSAGES.map((message, index) => <button key={message} type="button" className="flex min-h-11 items-center justify-between rounded-2xl bg-blue-50 px-3 text-left text-xs font-bold" style={{ color: '#1D4ED8' }} disabled={status !== 'connected'} onClick={() => void sendLobbyMessage(index).catch(sendError => setNotice(sendError instanceof Error ? sendError.message : 'Não foi possível enviar.'))}>{message}<Send size={14} /></button>)}</div>
      </aside>}

      {selectedPlayer && <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/55 p-3 sm:items-center sm:justify-center" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedPlayer(null) }}><section role="dialog" aria-modal="true" aria-labelledby="player-actions-title" className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 id="player-actions-title" className="font-title text-2xl" style={{ color: '#5B3A8A' }}>{selectedPlayer.avatar} {selectedPlayer.name}</h2><p className="mt-1 text-sm font-bold" style={{ color: '#2563A6' }}>{activityLabel(selectedPlayer)}</p></div><button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50" aria-label="Fechar opções" onClick={() => setSelectedPlayer(null)}><X /></button></div>
        <button type="button" className="btn-primary mt-4 w-full" disabled={Boolean(busy)} onClick={() => void invite(selectedPlayer)}><Gamepad2 size={18} /> Convidar para Jogo da Velha</button>
        {ownedGroups.length > 0 && <div className="mt-3"><p className="text-sm font-black" style={{ color: '#5B3A8A' }}>Convidar para um grupo seu</p><div className="mt-2 grid gap-2">{ownedGroups.map(group => <button key={group.id} type="button" className="btn-secondary min-h-11 w-full text-sm" disabled={Boolean(busy)} onClick={() => void inviteGroup(group.id, selectedPlayer)}>{group.name}</button>)}</div></div>}
        <form onSubmit={event => void makeGroup(event, selectedPlayer)} className="mt-3 rounded-2xl bg-purple-50 p-3"><label className="text-sm font-bold">Ou crie um grupo privado<input value={groupName} onChange={event => setGroupName(event.target.value.slice(0, 32))} maxLength={32} className="mt-1 min-h-11 w-full rounded-xl border border-purple-200 px-3" /></label><button type="submit" className="btn-secondary mt-2 w-full text-sm" disabled={Boolean(busy)}><Users size={17} /> Criar e convidar</button></form>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className="min-h-11 rounded-2xl bg-slate-100 px-3 text-sm font-black" onClick={() => void protectFromPlayer(selectedPlayer)}><Ban className="inline" size={16} /> Bloquear</button><button type="button" className="min-h-11 rounded-2xl bg-orange-50 px-3 text-sm font-black" style={{ color: '#9A3412' }} onClick={() => void protectFromPlayer(selectedPlayer, true)}><AlertTriangle className="inline" size={16} /> Denunciar</button></div>
      </section></div>}
    </section>
  )
}
