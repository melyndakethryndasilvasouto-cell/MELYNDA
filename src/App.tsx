import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PlayerProvider } from './contexts/PlayerContext'
import { SoundProvider } from './contexts/SoundContext'
import Layout from './components/Layout/Layout'
import HomePage from './components/Home/HomePage'
import PlayerSetup from './components/PlayerSetup'

// Games (lazy loaded)
import { lazy, Suspense } from 'react'
const Memory       = lazy(() => import('./games/Memory'))
const TicTacToe    = lazy(() => import('./games/TicTacToe'))
const Checkers     = lazy(() => import('./games/Checkers'))
const Uno          = lazy(() => import('./games/Uno'))
const ColorBook    = lazy(() => import('./games/ColorBook'))
const Snake        = lazy(() => import('./games/Snake'))
const SimonSays    = lazy(() => import('./games/SimonSays'))
const Quiz         = lazy(() => import('./games/Quiz'))
const SlidingPuzzle = lazy(() => import('./games/SlidingPuzzle'))
const Pong         = lazy(() => import('./games/Pong'))
const Devotional   = lazy(() => import('./components/Devotional/DevotionalPage'))

function LoadingGame() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="text-4xl">⭐</motion.div>
      <p className="font-bold" style={{ color: '#A78BFA' }}>Carregando...</p>
    </div>
  )
}

function AppRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <Suspense fallback={<LoadingGame />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/devocional" element={<Devotional />} />
            <Route path="/memoria" element={<Memory />} />
            <Route path="/jogo-da-velha" element={<TicTacToe />} />
            <Route path="/dama" element={<Checkers />} />
            <Route path="/uno" element={<Uno />} />
            <Route path="/colorir" element={<ColorBook />} />
            <Route path="/cobra" element={<Snake />} />
            <Route path="/simon" element={<SimonSays />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/quebra-cabeca" element={<SlidingPuzzle />} />
            <Route path="/pong" element={<Pong />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const [playerName, setPlayerName] = useState('')
  const [playerAvatar, setPlayerAvatar] = useState('⭐')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('mel-player-name')
    if (saved) {
      setPlayerName(saved)
      setPlayerAvatar(localStorage.getItem('mel-player-avatar') || '⭐')
      setReady(true)
    }
    else setReady(false)
  }, [])

  const handleSetup = (name: string, avatar: string) => {
    localStorage.setItem('mel-player-name', name)
    localStorage.setItem('mel-player-avatar', avatar)
    setPlayerName(name)
    setPlayerAvatar(avatar)
    setReady(true)
  }

  if (!ready && !playerName) return <PlayerSetup onComplete={handleSetup} />

  return (
    <SoundProvider>
      <PlayerProvider playerName={playerName} playerAvatar={playerAvatar}>
        <Layout>
          <AppRoutes />
        </Layout>
      </PlayerProvider>
    </SoundProvider>
  )
}
