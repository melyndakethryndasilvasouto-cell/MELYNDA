import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../../contexts/PlayerContext'
import GameCard from './GameCard'
import missions from '../../data/gameMissions.json'

const visualById: Record<string, { grad: string; badge?: string }> = {
  memoria: { grad: 'linear-gradient(135deg,#6BB8FF,#4A90D9)', badge: '1-2 jogadores' },
  velha: { grad: 'linear-gradient(135deg,#A78BFA,#7B5EA7)', badge: 'vs IA' },
  dama: { grad: 'linear-gradient(135deg,#818CF8,#4A90D9)', badge: 'vs IA' },
  uno: { grad: 'linear-gradient(135deg,#F472B6,#A78BFA)', badge: '2-4 jogadores' },
  colorir: { grad: 'linear-gradient(135deg,#FBBF24,#F97316)' },
  cobra: { grad: 'linear-gradient(135deg,#34D399,#059669)' },
  simon: { grad: 'linear-gradient(135deg,#60A5FA,#A78BFA)' },
  quiz: { grad: 'linear-gradient(135deg,#8B5CF6,#7B5EA7)', badge: '1-2 jogadores' },
  puzzle: { grad: 'linear-gradient(135deg,#22D3EE,#4A90D9)' },
  pong: { grad: 'linear-gradient(135deg,#4A90D9,#818CF8)', badge: '1-2 jogadores' },
}

const games = missions.map(mission => ({
  id: mission.gameId,
  name: mission.homeName,
  icon: mission.icon,
  path: mission.path,
  desc: mission.homeDescription,
  verseRef: mission.verseRef,
  ...visualById[mission.gameId],
}))

export default function HomePage() {
  const { playerName, playerAvatar, scores, achievements } = usePlayer()
  const navigate = useNavigate()

  return (
    <div className="pt-4">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2.5 }} className="text-5xl mb-2">
          {playerAvatar}
        </motion.div>
        <p className="uppercase tracking-widest text-xs font-black" style={{ color: '#B7791F' }}>Mel — Aventuras da Bíblia</p>
        <h1 className="font-title text-3xl mt-1" style={{ color: '#7B5EA7' }}>Olá, {playerName}! 👋</h1>
        <p className="font-bold mt-1 text-sm" style={{ color: '#4A90D9' }}>Vamos brincar, aprender e espalhar o amor de Jesus?</p>
      </motion.div>

      <section className="glass-card p-4 mb-4" aria-label="Progresso na jornada bíblica">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-sm" style={{ color: '#5B3A8A' }}>🌱 Jornada da Fé</h2>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Cada jogo traz uma verdade da Bíblia para viver hoje.</p>
          </div>
          <div className="text-right flex-shrink-0">
            <strong className="block text-lg" style={{ color: '#4A90D9' }}>{Object.keys(scores).length}</strong>
            <span className="text-[10px]" style={{ color: '#6B7280' }}>recordes</span>
          </div>
          <div className="text-right flex-shrink-0">
            <strong className="block text-lg" style={{ color: '#B7791F' }}>{achievements.length}</strong>
            <span className="text-[10px]" style={{ color: '#6B7280' }}>conquistas</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {games.map((game, i) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <GameCard game={game} onClick={() => navigate(game.path)} />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="text-center mt-8 font-bold text-sm"
        style={{ color: '#C4B5FD' }}
      >
        “Ensina a criança no caminho...” — Provérbios 22:6 🌿
      </motion.div>
    </div>
  )
}
