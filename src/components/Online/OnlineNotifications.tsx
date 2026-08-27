import { useState } from 'react'
import { Gamepad2, MessageCircle, ShieldCheck, Users, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import { activityForPath, ONLINE_GAME_LABELS } from '../../online/gameRegistry'

export default function OnlineNotifications() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { invites, groupInvites, respondInvite, respondGroupInvite, createGroup, inviteToGroup } = useOnline()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (pathname === '/online' || (!invites.length && !groupInvites.length)) return null

  const playInvite = invites[0]
  const groupInvite = groupInvites[0]
  const current = activityForPath(pathname)
  const currentGame = current.gameKey ? ONLINE_GAME_LABELS[current.gameKey] : ''

  const answerPlay = async (accept: boolean) => {
    if (!playInvite) return
    setBusy(true)
    setError('')
    try {
      const roomId = await respondInvite(playInvite.id, accept)
      if (accept) navigate(`/online/sala/${roomId}`)
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : 'Não foi possível responder.')
    } finally { setBusy(false) }
  }

  const chooseTogether = async () => {
    if (!playInvite) return
    setBusy(true)
    try {
      await respondInvite(playInvite.id, false)
      const groupId = await createGroup('Vamos escolher um jogo')
      await inviteToGroup(groupId, playInvite.from_user)
      navigate(`/online/grupo/${groupId}`)
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : 'Não foi possível abrir o grupo.')
    } finally { setBusy(false) }
  }

  const answerGroup = async (accept: boolean) => {
    if (!groupInvite) return
    setBusy(true)
    try {
      const groupId = await respondGroupInvite(groupInvite.id, accept)
      if (accept) navigate(`/online/grupo/${groupId}`)
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : 'Não foi possível responder.')
    } finally { setBusy(false) }
  }

  return (
    <aside className="fixed inset-x-3 top-[4.5rem] z-[80] mx-auto max-w-lg rounded-3xl border-2 border-blue-200 bg-white p-4 shadow-2xl" role="dialog" aria-modal="false" aria-labelledby="online-notification-title">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50" style={{ color: '#1D4ED8' }}>{playInvite ? <Gamepad2 /> : <Users />}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#047857' }}><ShieldCheck className="inline" size={14} /> Convite privado</p>
          {playInvite ? <><h2 id="online-notification-title" className="mt-1 font-black" style={{ color: '#374151' }}>{playInvite.from_avatar} {playInvite.from_name} chamou você para Jogo da Velha.</h2>{currentGame && <p className="mt-1 text-sm" style={{ color: '#4B5563' }}>Você está em {currentGame}. Nada será fechado sem você escolher.</p>}</> : <><h2 id="online-notification-title" className="mt-1 font-black">{groupInvite.from_avatar} {groupInvite.from_name} convidou você para “{groupInvite.group_name}”.</h2><p className="mt-1 text-sm">Somente convidados podem entrar nesse grupo.</p></>}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 rounded-xl bg-amber-50 p-2 text-sm font-bold" style={{ color: '#92400E' }}>{error}</p>}
      {playInvite ? <div className="mt-3 grid gap-2 sm:grid-cols-3"><button type="button" className="btn-primary min-h-11 px-3 text-sm" disabled={busy} onClick={() => void answerPlay(true)}>{current.activity === 'playing' ? 'Sair e jogar' : 'Aceitar jogo'}</button><button type="button" className="btn-secondary min-h-11 px-3 text-sm" disabled={busy} onClick={() => void chooseTogether()}><MessageCircle size={16} /> Conversar</button><button type="button" className="min-h-11 rounded-2xl bg-slate-100 px-3 text-sm font-black" disabled={busy} onClick={() => void answerPlay(false)}><X className="inline" size={16} /> Continuar aqui</button></div> : <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className="btn-primary min-h-11 px-3 text-sm" disabled={busy} onClick={() => void answerGroup(true)}>Entrar no grupo</button><button type="button" className="btn-secondary min-h-11 px-3 text-sm" disabled={busy} onClick={() => void answerGroup(false)}>Agora não</button></div>}
    </aside>
  )
}
