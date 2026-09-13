import { useLocation, useNavigate } from 'react-router-dom'
import { hasSystemOpponent, ONLINE_GAME_LABELS, onlineGameForPath } from '../../online/gameRegistry'
import OnlinePlayerList from './OnlinePlayerList'

export default function OnlineGameOption() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const gameKey = onlineGameForPath(pathname)

  if (!gameKey) return null

  const playsAgainstSystem = hasSystemOpponent(gameKey)

  return (
    <aside className="glass-card mb-4 flex flex-col gap-3 border-2 border-emerald-100 p-4" aria-label="Opções para jogar">
      <span className="text-3xl" aria-hidden="true">🎮</span>
      <span className="min-w-0 flex-1">
        <strong className="block" style={{ color: '#166534' }}>Escolha como jogar {ONLINE_GAME_LABELS[gameKey]}</strong>
        <span className="mt-1 block text-xs font-bold" style={{ color: '#4B5563' }}>
          {playsAgainstSystem ? 'Você está no modo contra o sistema, com três níveis de dificuldade.' : 'Você está no modo deste aparelho.'} Também pode convidar um amigo conhecido pelo código privado.
        </span>
      </span>
      <span className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-emerald-700 bg-emerald-50 px-4 text-center text-sm font-black text-emerald-900" aria-current="page">
        {playsAgainstSystem ? '🤖 Sistema · modo atual' : '▶ Neste aparelho · atual'}
      </span>
      <button
        type="button"
        className="btn-primary min-h-12 w-full text-sm"
        onClick={() => navigate(`/online?jogo=${gameKey}`)}
      >
        🌐 Jogar online com amigo
      </button>
      <OnlinePlayerList gameKey={gameKey} />
    </aside>
  )
}
