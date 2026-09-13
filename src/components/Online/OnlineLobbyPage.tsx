import { FormEvent, useCallback, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  Copy,
  Gamepad2,
  KeyRound,
  LoaderCircle,
  Plus,
  Radio,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import { activityLabel, ONLINE_GAME_LABELS, ONLINE_GAME_OPTIONS } from '../../online/gameRegistry'
import { OnlinePlayer } from '../../online/types'
import OnlineSafetyGate from './OnlineSafetyGate'
import { useAccessibleDialog } from '../../online/useAccessibleDialog'
import OnlineConfirmDialog from './OnlineConfirmDialog'

export default function OnlineLobbyPage() {
  const navigate = useNavigate()
  const {
    configured, safetyAccepted, status, userId, invites, groupInvites, groups, error,
    acceptSafety, goOffline,
    connect, invitePlayer, respondInvite, createGroup, inviteToGroup,
    respondGroupInvite, blockPlayer, reportPlayer,
  } = useOnline()
  const [busy, setBusy] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<OnlinePlayer | null>(null)
  const [pickingGameFor, setPickingGameFor] = useState<OnlinePlayer | null>(null)
  const [groupName, setGroupName] = useState('Turma da Bíblia')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [notice, setNotice] = useState('')
  const [friendCode, setFriendCode] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [confirmPlayer, setConfirmPlayer] = useState<{ player: OnlinePlayer; report: boolean } | null>(null)
  const playerDialogFirstRef = useRef<HTMLButtonElement>(null)
  const gameDialogFirstRef = useRef<HTMLButtonElement>(null)
  const closePlayerDialog = useCallback(() => setSelectedPlayer(null), [])
  const closeGameDialog = useCallback(() => {
    if (busy || !pickingGameFor) return
    setSelectedPlayer(pickingGameFor)
    setPickingGameFor(null)
  }, [busy, pickingGameFor])
  useAccessibleDialog(Boolean(selectedPlayer), closePlayerDialog, playerDialogFirstRef)
  useAccessibleDialog(Boolean(pickingGameFor), closeGameDialog, gameDialogFirstRef)

  const ownedGroups = useMemo(() => groups.filter(group => group.owner_id === userId), [groups, userId])

  const enterLobby = () => {
    acceptSafety()
    void connect()
  }

  const invite = async (player: OnlinePlayer, gameType = 'tic-tac-toe') => {
    setBusy(player.userId)
    setNotice('')
    try {
      const roomId = await invitePlayer(player.userId, gameType)
      setPickingGameFor(null)
      setSelectedPlayer(null)
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
    setSelectedPlayer(null)
    setConfirmPlayer({ player, report })
  }

  const retryConnection = async () => {
    setNotice('')
    await connect()
  }

  const copyFriendCode = async () => {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopyStatus('Código copiado! Envie somente para um amigo conhecido.')
    } catch {
      setCopyStatus('Selecione o código acima e copie manualmente.')
    }
  }

  const useFriendCode = (event: FormEvent) => {
    event.preventDefault()
    const code = friendCode.trim().toLowerCase()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(code)) {
      setNotice('Esse código não está completo. Cole exatamente o código enviado pelo seu amigo.')
      return
    }
    if (code === userId) {
      setNotice('Esse é o seu próprio código. Peça o código do seu amigo.')
      return
    }
    setNotice('')
    setSelectedPlayer({ userId: code, name: 'Amigo do código', avatar: '🔐', activity: 'lobby', gameKey: null, updatedAt: new Date().toISOString() })
  }

  const confirmProtection = async () => {
    if (!confirmPlayer) return
    const { player, report } = confirmPlayer
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
      setConfirmPlayer(null)
    }
  }

  if (!configured) {
    return <section className="glass-card mx-auto mt-8 max-w-md p-6 text-center"><span className="text-5xl" aria-hidden="true">🌐</span><h1 className="mt-3 font-title text-4xl" style={{ color: '#5B3A8A' }}>Jogos Online</h1><p className="mt-3 text-sm font-bold" style={{ color: '#6B7280' }}>O modo Online ainda precisa ser configurado.</p></section>
  }

  if (!safetyAccepted) {
    return <OnlineSafetyGate onAccept={enterLobby} notice={error} />
  }

  return (
    <section className="pb-28 pt-4">
      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="text-5xl" aria-hidden="true">🌐</div>
        <h1 className="mt-2 font-title text-3xl" style={{ color: '#5B3A8A' }}>Jogar com Amigos</h1>
        <p className="mx-auto mt-2 max-w-md text-sm font-bold" style={{ color: '#2563A6' }}>Entre por código privado. Não existe lista pública de crianças ou jogadores.</p>
      </motion.header>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-black" role="status" aria-live="polite" style={{ color: status === 'connected' ? '#166534' : status === 'error' ? '#92400E' : '#6B7280', background: status === 'connected' ? '#DCFCE7' : status === 'error' ? '#FEF3C7' : '#F3F4F6' }}>
        {status === 'connecting' ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : status === 'error' ? <AlertTriangle size={18} aria-hidden="true" /> : <Radio size={18} aria-hidden="true" />}
        <span>{status === 'connected' ? 'Conexão privada pronta' : status === 'error' ? 'Não foi possível conectar' : 'Conectando com segurança…'}</span>
        {status === 'error' && <button type="button" className="min-h-11 rounded-xl bg-white px-3 text-xs font-black shadow-sm" onClick={() => void retryConnection()}>Tentar novamente</button>}
        {status === 'connected' && <button type="button" className="min-h-14 rounded-xl bg-white px-3 text-xs font-black shadow-sm" onClick={() => void goOffline()}>Ficar offline</button>}
      </div>

      {(error || notice) && <p role="status" className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold" style={{ color: '#92400E' }}>{notice || error}</p>}

      <section className="glass-card mt-5 p-4" aria-labelledby="friend-code-title">
        <div className="flex items-center gap-2"><KeyRound size={20} aria-hidden="true" style={{ color: '#5B3A8A' }} /><h2 id="friend-code-title" className="font-black" style={{ color: '#5B3A8A' }}>Código privado de amizade</h2></div>
        <p className="mt-2 text-sm" style={{ color: '#4B5563' }}>Compartilhe seu código fora do site somente com um amigo conhecido e acompanhado por um adulto.</p>
        <label className="mt-3 block text-sm font-black">Seu código<input readOnly value={userId || 'Conectando…'} onFocus={event => event.currentTarget.select()} className="mt-1 min-h-12 w-full rounded-xl border-2 border-blue-100 bg-blue-50 px-3 font-mono text-xs" /></label>
        <button type="button" className="btn-secondary mt-2 w-full text-sm" disabled={!userId || status !== 'connected'} onClick={() => void copyFriendCode()}><Copy size={17} aria-hidden="true" /> Copiar meu código</button>
        {copyStatus && <p className="mt-2 text-xs font-bold" role="status" style={{ color: '#166534' }}>{copyStatus}</p>}
        <form className="mt-4 border-t border-purple-100 pt-4" onSubmit={useFriendCode}>
          <label htmlFor="friend-private-code" className="text-sm font-black">Código do seu amigo</label>
          <input id="friend-private-code" value={friendCode} onChange={event => setFriendCode(event.target.value.slice(0, 36))} maxLength={36} autoComplete="off" spellCheck={false} placeholder="00000000-0000-0000-0000-000000000000" className="mt-1 min-h-12 w-full rounded-xl border-2 border-purple-100 bg-white px-3 font-mono text-xs" />
          <button type="submit" className="btn-primary mt-2 w-full text-sm" disabled={status !== 'connected' || !friendCode.trim()}><Gamepad2 size={18} aria-hidden="true" /> Escolher jogo ou grupo</button>
        </form>
      </section>

      {(invites.length > 0 || groupInvites.length > 0) && (
        <section className="mt-5 space-y-3" aria-labelledby="invites-title">
          <h2 id="invites-title" className="font-black" style={{ color: '#5B3A8A' }}>Convites recebidos</h2>
          {invites.map(invite => (
            <article key={invite.id} className="glass-card p-4">
              <p className="font-black"><span aria-hidden="true">{invite.from_avatar}</span> {invite.from_name} quer jogar {invite.game ? ` ${ONLINE_GAME_LABELS[invite.game]}` : ''} com você.</p>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Users size={20} style={{ color: '#5B3A8A' }} /><h2 id="groups-title" className="font-black" style={{ color: '#5B3A8A' }}>Meus grupos privados</h2></div><button type="button" className="btn-secondary min-h-14 px-3 text-sm" onClick={() => setCreatingGroup(value => !value)}><Plus size={17} /> Criar grupo</button></div>
        {creatingGroup && <form onSubmit={event => void makeGroup(event)} className="glass-card mb-3 flex flex-col gap-2 p-4 sm:flex-row"><label className="min-w-0 flex-1 text-sm font-bold">Nome do grupo<input value={groupName} onChange={event => setGroupName(event.target.value.slice(0, 32))} maxLength={32} className="mt-1 min-h-14 w-full rounded-2xl border border-purple-200 px-3" /></label><button type="submit" className="btn-primary self-end text-sm" disabled={busy === 'new-group' || groupName.trim().length < 2}>Criar</button></form>}
        {groups.length ? <div className="grid gap-3 sm:grid-cols-2">{groups.map(group => <button key={group.id} type="button" onClick={() => navigate(`/online/grupo/${group.id}`)} className="glass-card min-h-20 p-4 text-left"><strong className="block" style={{ color: '#5B3A8A' }}>👥 {group.name}</strong><span className="mt-1 block text-xs" style={{ color: '#4B5563' }}>{group.owner_id === userId ? 'Você é o dono e controla os convites.' : 'Grupo fechado por convite.'}</span></button>)}</div> : <p className="glass-card p-4 text-center text-sm" style={{ color: '#6B7280' }}>Veja quem está online. Convide seus amigos! 💛</p>}
      </section>

      {selectedPlayer && !pickingGameFor && <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/55 p-3 sm:items-center sm:justify-center" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePlayerDialog() }}><section role="dialog" aria-modal="true" aria-labelledby="player-actions-title" aria-busy={Boolean(busy)} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 id="player-actions-title" className="break-words font-title text-2xl" style={{ color: '#5B3A8A' }}>{selectedPlayer.avatar} {selectedPlayer.name}</h2><p className="mt-1 text-sm font-bold" style={{ color: '#1D4E89' }}>{activityLabel(selectedPlayer)}</p></div><button ref={playerDialogFirstRef} type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50" aria-label="Fechar opções" onClick={closePlayerDialog}><X /></button></div>
        {notice && <p role="status" className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold" style={{ color: '#92400E' }}>{notice}</p>}
        {busy && <p role="status" className="mt-2 text-center text-sm font-bold" style={{ color: '#5B3A8A' }}>Aguarde um pouquinho…</p>}
        <button type="button" className="btn-primary mt-4 w-full" disabled={Boolean(busy)} onClick={() => { setPickingGameFor(selectedPlayer); setSelectedPlayer(null) }}><Gamepad2 size={18} /> Escolher jogo e convidar</button>
        {ownedGroups.length > 0 && <div className="mt-3"><p className="text-sm font-black" style={{ color: '#5B3A8A' }}>Convidar para um grupo seu</p><div className="mt-2 grid gap-2">{ownedGroups.map(group => <button key={group.id} type="button" className="btn-secondary min-h-14 w-full text-sm" disabled={Boolean(busy)} onClick={() => void inviteGroup(group.id, selectedPlayer)}>{group.name}</button>)}</div></div>}
        <form onSubmit={event => void makeGroup(event, selectedPlayer)} className="mt-3 rounded-2xl bg-purple-50 p-3"><label className="text-sm font-bold">Ou crie um grupo privado<input value={groupName} onChange={event => setGroupName(event.target.value.slice(0, 32))} maxLength={32} className="mt-1 min-h-14 w-full rounded-xl border border-purple-200 px-3" /></label><button type="submit" className="btn-secondary mt-2 w-full text-sm" disabled={Boolean(busy)}><Users size={17} /> Conversar e escolher um jogo</button></form>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className="min-h-14 rounded-2xl bg-slate-100 px-3 text-sm font-black" onClick={() => void protectFromPlayer(selectedPlayer)}><Ban className="inline" size={16} /> Bloquear</button><button type="button" className="min-h-14 rounded-2xl bg-orange-50 px-3 text-sm font-black" style={{ color: '#9A3412' }} onClick={() => void protectFromPlayer(selectedPlayer, true)}><AlertTriangle className="inline" size={16} /> Denunciar</button></div>
      </section></div>}

      {/* 🎮 Game Picker Modal */}
      <AnimatePresence>
        {pickingGameFor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
            onMouseDown={e => { if (e.target === e.currentTarget) closeGameDialog() }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="online-game-picker-title"
              aria-describedby="online-game-picker-description"
              aria-busy={Boolean(busy)}
              className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pl-11 text-center">
                  <h2 id="online-game-picker-title" className="font-title text-xl" style={{ color: '#5B3A8A' }}>Qual jogo você quer jogar?</h2>
                  <p id="online-game-picker-description" className="mt-1 break-words text-xs font-bold" style={{ color: '#6B7280' }}>com <span aria-hidden="true">{pickingGameFor.avatar}</span> {pickingGameFor.name}</p>
                </div>
                <button ref={gameDialogFirstRef} type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50" aria-label="Voltar para as opções do jogador" disabled={Boolean(busy)} onClick={closeGameDialog}><X size={20} aria-hidden="true" /></button>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {ONLINE_GAME_OPTIONS.map(g => (
                  <button key={g.key} type="button"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left font-black transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg,#EDE9FE,#DBEAFE)', color: '#5B3A8A', border: '2px solid #C4B5FD' }}
                    disabled={Boolean(busy)}
                    onClick={() => void invite(pickingGameFor, g.key)}
                  >
                    <span className="text-2xl" aria-hidden="true">{g.emoji}</span>
                    <span>{g.label}</span>
                    {busy === pickingGameFor.userId && <span className="ml-auto text-xs">Enviando…</span>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={closeGameDialog} disabled={Boolean(busy)}
                className="mt-4 w-full rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-600">
                Voltar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <OnlineConfirmDialog
        open={Boolean(confirmPlayer)}
        title={confirmPlayer?.report ? 'Denunciar jogador?' : 'Bloquear jogador?'}
        message={confirmPlayer ? `Deseja ${confirmPlayer.report ? 'denunciar e bloquear' : 'bloquear'} ${confirmPlayer.player.name}? Ele não aparecerá mais para você.` : ''}
        confirmLabel={confirmPlayer?.report ? 'Denunciar' : 'Bloquear'}
        danger
        onCancel={() => setConfirmPlayer(null)}
        onConfirm={confirmProtection}
      />
    </section>
  )
}
