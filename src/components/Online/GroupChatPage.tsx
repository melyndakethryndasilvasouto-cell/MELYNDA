import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ban, Crown, LoaderCircle, LogOut, Send, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import type { EphemeralAudioBroadcastPayload } from '../../online/useEphemeralAudioMessage'
import { OnlineChatMessage, OnlineGroup, OnlineGroupMember } from '../../online/types'
import { supabase } from '../../services/supabase'
import AudioMessageComposer from './AudioMessageComposer'

function groupMessageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (message.includes('MESSAGE_PERSONAL_DATA')) return 'Essa mensagem pode mostrar informação pessoal. Escreva de outro jeito.'
  if (message.includes('MESSAGE_UNSAFE')) return 'Essa mensagem não parece segura para um chat infantil.'
  if (message.includes('MESSAGE_RATE_LIMIT')) return 'Espere um pouquinho antes de enviar outra mensagem.'
  return 'Não foi possível enviar agora.'
}

export default function GroupChatPage() {
  const { groupId = '' } = useParams()
  const navigate = useNavigate()
  const { status, userId, players, connect, inviteToGroup, blockPlayer, reportPlayer } = useOnline()
  const [group, setGroup] = useState<OnlineGroup | null>(null)
  const [members, setMembers] = useState<OnlineGroupMember[]>([])
  const [messages, setMessages] = useState<OnlineChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [busy, setBusy] = useState('')

  useEffect(() => { void connect() }, [connect])

  const load = useCallback(async () => {
    if (!supabase || !groupId || !userId) return
    const [groupResult, memberResult, messageResult] = await Promise.all([
      supabase.from('online_groups').select('*').eq('id', groupId).single(),
      supabase.from('online_group_members').select('*').eq('group_id', groupId).order('joined_at'),
      supabase.from('online_group_messages').select('*').eq('group_id', groupId).gt('expires_at', new Date().toISOString()).order('created_at').limit(100),
    ])
    if (groupResult.error) throw groupResult.error
    if (memberResult.error) throw memberResult.error
    if (messageResult.error) throw messageResult.error
    setGroup(groupResult.data as OnlineGroup)
    setMembers((memberResult.data || []) as OnlineGroupMember[])
    setMessages((messageResult.data || []) as OnlineChatMessage[])
  }, [groupId, userId])

  useEffect(() => {
    if (!supabase || status !== 'connected' || !userId || !groupId) return
    let active = true
    setLoading(true)
    void load().catch(() => setError('Este grupo não existe ou você não participa dele.')).finally(() => { if (active) setLoading(false) })
    const channel = supabase.channel(`online-group-events:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_group_messages', filter: `group_id=eq.${groupId}` }, () => { if (active) void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_group_members', filter: `group_id=eq.${groupId}` }, () => { if (active) void load() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_groups', filter: `id=eq.${groupId}` }, () => { if (active) void load() })
      .subscribe()
    return () => { active = false; void supabase.removeChannel(channel) }
  }, [groupId, load, status, userId])

  const memberIds = useMemo(() => new Set(members.map(member => member.user_id)), [members])
  const possibleInvites = players.filter(player => player.userId !== userId && !memberIds.has(player.userId))
  const owner = group?.owner_id === userId

  const sendText = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || draft.trim().length < 1) return
    setBusy('message')
    setError('')
    const result = await supabase.rpc('send_online_group_message', { target_group: groupId, message_text: draft })
    if (result.error) setError(groupMessageError(result.error))
    else {
      const message = result.data as OnlineChatMessage
      setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous.slice(-99), message])
      setDraft('')
    }
    setBusy('')
  }

  const sendAudio = useCallback(async (payload: EphemeralAudioBroadcastPayload) => {
    if (!supabase) throw new Error('NOT_CONFIGURED')
    const result = await supabase.rpc('send_online_group_audio', {
      target_group: groupId,
      audio_value: `data:${payload.mimeType};base64,${payload.dataBase64}`,
      mime_value: payload.mimeType,
      duration_value: payload.durationMs,
    })
    if (result.error) throw new Error(groupMessageError(result.error))
    const message = result.data as OnlineChatMessage
    setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous.slice(-99), message])
  }, [groupId])

  const invite = async (targetId: string) => {
    setBusy(targetId)
    try {
      await inviteToGroup(groupId, targetId)
      setError('Convite enviado. A pessoa precisa aceitar para entrar.')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Não foi possível convidar.')
    } finally { setBusy('') }
  }

  const leaveOrClose = async () => {
    if (!supabase || !group) return
    const functionName = owner ? 'close_online_group' : 'leave_online_group'
    const args = { target_group: group.id }
    const result = await supabase.rpc(functionName, args)
    if (result.error) setError('Não foi possível sair do grupo agora.')
    else navigate('/online')
  }

  const removeMember = async (memberId: string) => {
    if (!supabase) return
    setBusy(memberId)
    const result = await supabase.rpc('remove_online_group_member', { target_group: groupId, target: memberId })
    if (result.error) setError('Não foi possível remover esse participante.')
    else await load()
    setBusy('')
  }

  const protect = async (member: OnlineGroupMember, report = false) => {
    setBusy(member.user_id)
    try {
      if (report) await reportPlayer(member.user_id, 'other', 'group')
      await blockPlayer(member.user_id)
      setError(report ? 'Denúncia recebida e jogador bloqueado.' : 'Jogador bloqueado.')
    } catch (protectError) {
      setError(protectError instanceof Error ? protectError.message : 'Não foi possível concluir.')
    } finally { setBusy('') }
  }

  if (loading || status === 'connecting') return <div className="flex min-h-[60vh] items-center justify-center gap-2 font-bold"><LoaderCircle className="animate-spin" /> Abrindo grupo privado…</div>
  if (!group) return <section className="glass-card mt-8 p-6 text-center"><h1 className="font-title text-2xl">Grupo indisponível</h1><p className="mt-2">{error}</p><button className="btn-primary mt-4" onClick={() => navigate('/online')}>Voltar</button></section>

  return (
    <section className="pb-10 pt-3">
      <header className="glass-card p-4">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#047857' }}><ShieldCheck className="inline" size={15} /> Grupo fechado por convite</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-title text-3xl" style={{ color: '#5B3A8A' }}>👥 {group.name}</h1><p className="text-sm" style={{ color: '#4B5563' }}>{members.length} de {group.max_members} participantes</p></div><div className="flex gap-2">{owner && <button type="button" className="btn-primary min-h-11 px-3 text-sm" onClick={() => setInviteOpen(true)}><Users size={17} /> Convidar</button>}<button type="button" className="btn-secondary min-h-11 px-3 text-sm" onClick={() => void leaveOrClose()}>{owner ? <Trash2 size={17} /> : <LogOut size={17} />}{owner ? 'Encerrar' : 'Sair'}</button></div></div>
      </header>

      {error && <p role="status" className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold" style={{ color: '#92400E' }}>{error}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
        <section className="glass-card flex min-h-[620px] min-w-0 flex-col overflow-hidden" aria-labelledby="group-chat-title">
          <div className="border-b border-purple-100 p-4"><h2 id="group-chat-title" className="font-black" style={{ color: '#5B3A8A' }}>Conversa do grupo</h2><p className="text-xs" style={{ color: '#4B5563' }}>Somente os convidados deste grupo podem ler. Mensagens deixam de ficar disponíveis após 24 horas.</p></div>
          <div className="min-h-52 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3" role="log" aria-live="polite">{messages.length === 0 ? <p className="py-10 text-center text-sm" style={{ color: '#6B7280' }}>Escreva uma mensagem gentil para a turma.</p> : messages.map(message => { const mine = message.sender_id === userId; return <article key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className="max-w-[88%] rounded-2xl px-3 py-2" style={{ background: mine ? '#DBEAFE' : '#F3E8FF', overflowWrap: 'anywhere' }}><strong className="block text-xs">{message.sender_avatar} {message.sender_name}</strong>{message.kind === 'text' ? <p className="mt-1 text-sm">{message.body}</p> : <audio controls preload="none" src={message.audio_data || ''} className="mt-2 max-w-full" aria-label={`Áudio de ${message.sender_name}`} />}</div></article> })}</div>
          <div className="border-t border-purple-100 bg-white p-3" style={{ paddingBottom: 'max(.75rem, env(safe-area-inset-bottom))' }}><form className="flex gap-2" onSubmit={sendText}><label htmlFor="group-message" className="sr-only">Mensagem para o grupo</label><input id="group-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={180} placeholder="Escreva com carinho…" className="min-h-11 min-w-0 flex-1 rounded-2xl border border-purple-200 px-3 text-sm" /><button type="submit" className="btn-primary h-11 w-11 p-0" aria-label="Enviar mensagem" disabled={busy === 'message' || !draft.trim()}><Send size={18} /></button></form><AudioMessageComposer disabled={Boolean(busy)} onSend={sendAudio} /><p className="mt-2 text-xs font-bold" style={{ color: '#4B5563' }}>Não compartilhe dados pessoais. Se algo incomodar, bloqueie, denuncie e conte a um adulto.</p></div>
        </section>

        <aside className="glass-card h-fit p-4" aria-labelledby="members-title"><h2 id="members-title" className="font-black" style={{ color: '#5B3A8A' }}>Participantes</h2><div className="mt-3 space-y-3">{members.map(member => <article key={member.user_id} className="rounded-2xl bg-white p-3"><div className="flex items-center gap-2"><span className="text-2xl">{member.avatar}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{member.display_name}</strong><span className="text-xs">{member.role === 'owner' ? 'Dono do grupo' : 'Convidado'}</span></span>{member.role === 'owner' && <Crown size={17} style={{ color: '#B45309' }} />}</div>{member.user_id !== userId && <div className="mt-2 grid grid-cols-2 gap-1"><button type="button" className="min-h-10 rounded-xl bg-slate-100 text-xs font-bold" onClick={() => void protect(member)}><Ban className="inline" size={14} /> Bloquear</button><button type="button" className="min-h-10 rounded-xl bg-orange-50 text-xs font-bold" style={{ color: '#9A3412' }} onClick={() => void protect(member, true)}><AlertTriangle className="inline" size={14} /> Denunciar</button>{owner && member.role !== 'owner' && <button type="button" className="col-span-2 min-h-10 rounded-xl bg-red-50 text-xs font-bold" style={{ color: '#B91C1C' }} disabled={busy === member.user_id} onClick={() => void removeMember(member.user_id)}>Remover do grupo</button>}</div>}</article>)}</div></aside>
      </div>

      {inviteOpen && <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/55 p-3 sm:items-center sm:justify-center" onMouseDown={event => { if (event.target === event.currentTarget) setInviteOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="group-invite-title" className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5"><div className="flex justify-between gap-3"><div><h2 id="group-invite-title" className="font-title text-2xl" style={{ color: '#5B3A8A' }}>Convidar para o grupo</h2><p className="text-sm">Somente você, como dono, pode enviar estes convites.</p></div><button type="button" className="h-11 w-11 rounded-2xl bg-purple-50" aria-label="Fechar" onClick={() => setInviteOpen(false)}><X className="mx-auto" /></button></div><div className="mt-4 space-y-2">{possibleInvites.length ? possibleInvites.map(player => <button key={player.userId} type="button" className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left" disabled={Boolean(busy)} onClick={() => void invite(player.userId)}><span className="text-2xl">{player.avatar}</span><span className="flex-1 font-black">{player.name}</span><span className="text-xs font-bold" style={{ color: '#2563A6' }}>Convidar</span></button>) : <p className="py-6 text-center text-sm">Não há outro amigo disponível agora.</p>}</div></section></div>}
    </section>
  )
}
