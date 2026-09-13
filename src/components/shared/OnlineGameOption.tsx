import { useLocation, useNavigate } from 'react-router-dom'
import { ONLINE_GAME_LABELS, onlineGameForPath } from '../../online/gameRegistry'

export default function OnlineGameOption() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const gameKey = onlineGameForPath(pathname)

  if (!gameKey) return null

  return (
    <aside className="glass-card mb-4 flex flex-col gap-3 border-2 border-emerald-100 p-4 sm:flex-row sm:items-center" aria-label="Opções para jogar">
      <span className="text-3xl" aria-hidden="true">🎮</span>
      <span className="min-w-0 flex-1">
        <strong className="block" style={{ color: '#166534' }}>Escolha como jogar {ONLINE_GAME_LABELS[gameKey]}</strong>
        <span className="mt-1 block text-xs font-bold" style={{ color: '#4B5563' }}>Continue neste aparelho ou convide um amigo conhecido pelo código privado.</span>
      </span>
      <button
        type="button"
        className="btn-primary min-h-12 shrink-0 text-sm"
        onClick={() => navigate(`/online?jogo=${gameKey}`)}
      >
        🌐 Jogar online
      </button>
    </aside>
  )
}
