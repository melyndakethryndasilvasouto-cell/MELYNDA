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
    try { return JSON.parse(localStorage.getItem('mel-scores') || '{}') } catch { return {} }
  })
  const [achievements, setAchievements] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mel-achievements') || '[]') } catch { return [] }
  })

  const updateScore = useCallback((game: string, score: number) => {
    setScores(prev => {
      const next = { ...prev, [game]: Math.max(prev[game] ?? 0, score) }
      localStorage.setItem('mel-scores', JSON.stringify(next))
      return next
    })
  }, [])

  const addAchievement = useCallback((id: string) => {
    setAchievements(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      localStorage.setItem('mel-achievements', JSON.stringify(next))
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
