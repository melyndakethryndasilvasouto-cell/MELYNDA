import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface PlayerContextType {
  playerName: string
  playerAvatar: string
  scores: Record<string, number>
  updateScore: (game: string, score: number) => void
  achievements: string[]
  addAchievement: (id: string) => void
}

const PlayerContext = createContext<PlayerContextType | null>(null)

export function PlayerProvider({ children, playerName, playerAvatar }: { children: ReactNode; playerName: string; playerAvatar: string }) {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mel-scores') || '{}')
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
      return Object.fromEntries(Object.entries(saved).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) as Record<string, number>
    } catch { return {} }
  })
  const [achievements, setAchievements] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mel-achievements') || '[]')
      return Array.isArray(saved) ? [...new Set(saved.filter((value): value is string => typeof value === 'string'))] : []
    } catch { return [] }
  })

  const updateScore = useCallback((game: string, score: number) => {
    if (!Number.isFinite(score) || score < 0) return
    setScores(prev => {
      const next = { ...prev, [game]: Math.max(prev[game] ?? 0, score) }
      try { localStorage.setItem('mel-scores', JSON.stringify(next)) } catch { /* Continue playing in memory when storage is unavailable. */ }
      return next
    })
  }, [])

  const addAchievement = useCallback((id: string) => {
    setAchievements(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      try { localStorage.setItem('mel-achievements', JSON.stringify(next)) } catch { /* Keep this session's progress. */ }
      return next
    })
  }, [])

  return (
    <PlayerContext.Provider value={{ playerName, playerAvatar, scores, updateScore, achievements, addAchievement }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
