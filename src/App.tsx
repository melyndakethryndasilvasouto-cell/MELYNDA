import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { PlayerProvider } from './contexts/PlayerContext'
import { SoundProvider } from './contexts/SoundContext'
import { OnlineProvider } from './contexts/OnlineContext'
import Layout from './components/Layout/Layout'
import HomePage from './components/Home/HomePage'
import PlayerSetup from './components/PlayerSetup'
import PageErrorBoundary from './components/shared/PageErrorBoundary'
import missions from './data/gameMissions.json'

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
const Forca        = lazy(() => import('./games/Hangman'))
const Multiplication = lazy(() => import('./games/Multiplication'))
const Chess        = lazy(() => import('./games/Chess'))
const RockPaperScissors = lazy(() => import('./games/RockPaperScissors'))
const Adedonha     = lazy(() => import('./games/Adedonha'))
const Devotional   = lazy(() => import('./components/Devotional/DevotionalPage'))
const OnlineLobby  = lazy(() => import('./components/Online/OnlineLobbyPage'))
const OnlineRoom   = lazy(() => import('./components/Online/OnlineRoomPage'))
const GroupChat    = lazy(() => import('./components/Online/GroupChatPage'))

function LoadingGame() {
  return (
    <div role="status" className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="text-4xl">⭐</motion.div>
      <p className="font-bold" style={{ color: '#A78BFA' }}>Carregando...</p>
    </div>
  )
}

function AppRoutes() {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    const title = missions.find(mission => mission.path === location.pathname)?.homeName
      || (location.pathname.startsWith('/online') ? 'Jogar online' : location.pathname === '/devocional' ? 'Devocional' : location.pathname === '/' ? 'Jogos' : 'P?gina n?o encontrada')
    document.title = `${title} ? Mel ? Aventuras da B?blia`
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const focusFrame = window.requestAnimationFrame(() => document.getElementById('main-content')?.focus())
    return () => window.cancelAnimationFrame(focusFrame)
  }, [location.pathname])
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <PageErrorBoundary key={location.pathname}>
        <Suspense fallback={<LoadingGame />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/devocional" element={<Devotional />} />
            <Route path="/online" element={<OnlineLobby />} />
            <Route path="/online/sala/:roomId" element={<OnlineRoom />} />
            <Route path="/online/grupo/:groupId" element={<GroupChat />} />
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
            <Route path="/forca" element={<Forca />} />
            <Route path="/tabuada" element={<Multiplication />} />
            <Route path="/xadrez" element={<Chess />} />
            <Route path="/pedra-papel-tesoura" element={<RockPaperScissors />} />
            <Route path="/adedonha" element={<Adedonha />} />
            <Route path="*" element={
              <section className="glass-card p-6 text-center space-y-4">
                <h1 className="font-title text-2xl text-purple-900">Esse caminho n?o existe</h1>
                <p className="text-gray-700">Vamos voltar aos jogos e escolher uma nova aventura?</p>
                <Link to="/" className="btn-primary">Voltar aos jogos</Link>
              </section>
            } />
          </Routes>
        </Suspense>
        </PageErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const [playerName, setPlayerName] = useState('')
  const [playerAvatar, setPlayerAvatar] = useState('⭐')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mel-player-name')?.trim().slice(0, 16)
      if (saved) {
        setPlayerName(saved)
        setPlayerAvatar(localStorage.getItem('mel-player-avatar')?.slice(0, 16) || '?')
        setReady(true)
      }
    } catch { /* Allow setup even when the browser blocks local storage. */ }
  }, [])

  const handleSetup = (name: string, avatar: string) => {
    try {
      localStorage.setItem('mel-player-name', name)
      localStorage.setItem('mel-player-avatar', avatar)
    } catch { /* A player can still use this session without persistence. */ }
    setPlayerName(name)
    setPlayerAvatar(avatar)
    setReady(true)
  }

  if (!ready && !playerName) return <MotionConfig reducedMotion="user"><PlayerSetup onComplete={handleSetup} /></MotionConfig>

  return (
    <MotionConfig reducedMotion="user">
    <SoundProvider>
      <PlayerProvider playerName={playerName} playerAvatar={playerAvatar}>
        <OnlineProvider>
          <Layout>
            <AppRoutes />
          </Layout>
        </OnlineProvider>
      </PlayerProvider>
    </SoundProvider>
    </MotionConfig>
  )
}
