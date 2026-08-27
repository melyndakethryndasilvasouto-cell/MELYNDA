interface Game {
  id: string; name: string; icon: string; path: string; grad: string; desc: string; badge?: string; verseRef?: string
}
interface Props { game: Game; onClick: () => void; delay?: number }

export default function GameCard({ game, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="glass-card p-4 flex flex-col items-center gap-2 hover:-translate-y-1 hover:shadow-xl active:scale-95 transition-all duration-150 w-full text-left group relative overflow-hidden"
      style={{ minHeight: 170 }}
    >
      {game.badge && (
        <span className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'linear-gradient(135deg,#6BB8FF,#A78BFA)', color: 'white', fontSize: 10 }}>
          {game.badge}
        </span>
      )}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg transition-transform group-active:scale-90"
        style={{ background: game.grad, boxShadow: '0 4px 15px rgba(107,184,255,0.3)' }}
      >
        {game.icon}
      </div>
      <span className="font-bold text-sm text-center leading-tight" style={{ color: '#374151' }}>{game.name}</span>
      <span className="text-xs text-center" style={{ color: '#9CA3AF' }}>{game.desc}</span>
      {game.verseRef && <span className="verse-chip mt-auto">{game.verseRef}</span>}
    </button>
  )
}
