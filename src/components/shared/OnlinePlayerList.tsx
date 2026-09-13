import { useState } from 'react'
import { LoaderCircle, Radio } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOnline } from '../../contexts/OnlineContext'
import type { OnlineGameKey } from '../../online/types'
import { activityLabel, ONLINE_GAME_LABELS } from '../../online/gameRegistry'

interface Props {
  gameKey: OnlineGameKey
}

export default function OnlinePlayerList({ gameKey }: Props) {
  const navigate = useNavigate()
  const { configured, safetyAccepted, status, userId, players, error, connect, invitePlayer } = useOnline()
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const invite = async (player: (typeof players)[number]) => {
    setBusy(player.userId)
    setNotice('')
    try {
      const roomId = await invitePlayer(player.userId, gameKey)
      navigate(`/online/sala/${roomId}`)
    } catch (inviteError) {
      setNotice(inviteError instanceof Error ? inviteError.message : 'Não foi possível enviar o convite.')
    } finally {
      setBusy('')
    }
  }

  const availablePlayers = players.filter(player => player.userId !== userId)

  return (
    <section className="mt-3 rounded-2xl border-2 border-emerald-100 bg-white/75 p-3" aria-labelledby={`online-players-${gameKey}`}>
      <div className="flex items-start gap-2">
        <Radio size={19} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: '#047857' }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 id={`online-players-${gameKey}`} className="font-black" style={{ color: '#166534' }}>Amigos online agora</h2>
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-black text-green-800" aria-label={`${availablePlayers.length} pessoas online`}>
              {availablePlayers.length}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold" style={{ color: '#4B5563' }}>
            Convide alguém para jogar {ONLINE_GAME_LABELS[gameKey]}.
          </p>
        </div>
      </div>

      {!configured && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-bold" style={{ color: '#6B7280' }}>O modo Online ainda não foi configurado.</p>}

      {configured && !safetyAccepted && (
        <div className="mt-3 rounded-xl bg-blue-50 p-3">
          <p className="text-xs font-bold" style={{ color: '#1D4E89' }}>Leia as regras rápidas para jogar com amigos conhecidos.</p>
          <button type="button" className="btn-secondary mt-2 min-h-11 w-full px-3 text-xs" onClick={() => navigate(`/online?jogo=${gameKey}`)}>
            Ver regras e amigos online
          </button>
        </div>
      )}

      {configured && safetyAccepted && status === 'connecting' && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800" role="status">
          <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Procurando amigos online…
        </p>
      )}

      {configured && safetyAccepted && status === 'error' && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p role="alert" className="text-xs font-bold" style={{ color: '#92400E' }}>{error || 'A conexão não respondeu.'}</p>
          <button type="button" className="btn-secondary mt-2 min-h-11 w-full px-3 text-xs" onClick={() => void connect()}>
            Tentar novamente
          </button>
        </div>
      )}

      {configured && safetyAccepted && status === 'connected' && availablePlayers.length === 0 && (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-center text-xs font-bold" style={{ color: '#6B7280' }}>
          Nenhum amigo disponível agora. Quando ele entrar no site, aparecerá aqui.
        </p>
      )}

      {configured && safetyAccepted && availablePlayers.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {availablePlayers.map(player => (
            <div key={player.userId} className="flex min-w-0 items-center gap-2 rounded-xl border border-green-100 bg-white p-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-xl" aria-hidden="true">{player.avatar}</span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm" style={{ color: '#374151' }}>{player.name}</strong>
                <span className="block truncate text-[11px] font-bold" style={{ color: '#6B7280' }}>{activityLabel(player)}</span>
              </span>
              <button type="button" className="btn-primary min-h-10 shrink-0 px-3 text-xs" disabled={Boolean(busy) || player.activity === 'playing'} onClick={() => void invite(player)} aria-label={player.activity === 'playing' ? `${player.name} está jogando agora` : `Convidar ${player.name} para ${ONLINE_GAME_LABELS[gameKey]}`}>
                {player.activity === 'playing' ? 'Jogando' : busy === player.userId ? 'Enviando…' : 'Convidar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {notice && <p role="status" className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-bold" style={{ color: '#92400E' }}>{notice}</p>}
      {configured && safetyAccepted && status === 'connected' && <p className="mt-2 text-[11px] font-bold" style={{ color: '#6B7280' }}>Só o apelido e o avatar aparecem para os amigos.</p>}
    </section>
  )
}
