interface Game {
  id: string; name: string; icon: string; path: string; grad: string; desc: string; badge?: string; verseRef?: string
}
interface Props {
  game: Game
  hasSystemOpponent: boolean
  onLocalClick: () => void
  onOnlineClick?: () => void
}

export default function GameCard({ game, hasSystemOpponent, onLocalClick, onOnlineClick }: Props) {
  const titleId = `game-card-${game.id}`
  return (
    <article
      className="glass-card flex w-full flex-col items-center gap-2 overflow-hidden p-4 text-center"
      style={{ minHeight: 270 }}
      aria-labelledby={titleId}
    >
      {game.badge && (
        <span className="self-end rounded-full px-2 py-1 text-xs font-black"
          style={{ background: 'linear-gradient(135deg,#1D4ED8,#6D28D9)', color: 'white', fontSize: 12 }}>
          {game.badge}
        </span>
      )}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg transition-transform group-active:scale-90"
        style={{ background: game.grad, boxShadow: '0 4px 15px rgba(107,184,255,0.3)' }}
      >
        {game.icon}
      </div>
      <h2 id={titleId} className="text-center text-sm font-bold leading-tight" style={{ color: '#374151' }}>{game.name}</h2>
      <span className="text-xs text-center" style={{ color: '#4B5563' }}>{game.desc}</span>
      {game.verseRef && <span className="verse-chip mt-auto">{game.verseRef}</span>}
      <div className="mt-2 grid w-full gap-2">
        <button
          type="button"
          onClick={onLocalClick}
          className="btn-primary min-h-12 w-full px-3 py-3 text-sm"
          aria-label={`${hasSystemOpponent ? 'Jogar contra o sistema em três níveis' : 'Jogar neste aparelho'}: ${game.name}`}
        >
          {hasSystemOpponent ? '🤖 Contra o sistema · 3 níveis' : '▶ Neste aparelho'}
        </button>
        {onOnlineClick && (
          <button
            type="button"
            onClick={onOnlineClick}
            className="btn-secondary min-h-12 w-full px-3 py-3 text-sm"
            aria-label={`Jogar online com um amigo: ${game.name}`}
          >
            🌐 Jogar online
          </button>
        )}
      </div>
    </article>
  )
}
