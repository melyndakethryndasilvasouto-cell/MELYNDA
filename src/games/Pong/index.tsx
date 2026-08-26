import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 380
const H = 600
const PADDLE_W = 80
const PADDLE_H = 12
const PADDLE_Y_MARGIN = 36
const BALL_R = 8
const WIN_SCORE = 7
const BASE_SPEED = 5
const MAX_SPEED_MULT = 1.5
const SPEED_INCREMENT = 0.04
const AI_EASY = 0.60
const AI_HARD = 0.90

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = 'menu' | 'solo' | 'duo'
type Difficulty = 'easy' | 'hard'
type SpeedMult = 1 | 1.5
type Phase = 'idle' | 'playing' | 'paused' | 'scored' | 'gameover'

interface Ball {
  x: number; y: number
  vx: number; vy: number
  speed: number
}

interface Paddle {
  x: number; y: number
  w: number; h: number
}

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number
  color: string
}

interface GameState {
  ball: Ball
  p1: Paddle
  p2: Paddle
  score1: number
  score2: number
  phase: Phase
  particles: Particle[]
  scoredTimer: number
  lastScorer: 1 | 2 | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function makeBall(towardsPlayer: 1 | 2 = 1, speedMult: SpeedMult = 1): Ball {
  const speed = BASE_SPEED * speedMult
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180)
  const dirY = towardsPlayer === 1 ? 1 : -1
  return {
    x: W / 2,
    y: H / 2,
    vx: Math.sin(angle) * speed,
    vy: dirY * Math.cos(angle) * speed,
    speed,
  }
}

function makePaddles(): { p1: Paddle; p2: Paddle } {
  return {
    p1: { x: W / 2 - PADDLE_W / 2, y: H - PADDLE_Y_MARGIN - PADDLE_H, w: PADDLE_W, h: PADDLE_H },
    p2: { x: W / 2 - PADDLE_W / 2, y: PADDLE_Y_MARGIN, w: PADDLE_W, h: PADDLE_H },
  }
}

function spawnParticles(x: number, y: number, color: string): Particle[] {
  return Array.from({ length: 12 }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 6,
    vy: (Math.random() - 0.5) * 6,
    life: 1,
    color,
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Pong() {
  const { playSound } = useSound()
  const { updateScore } = usePlayer()

  const [mode, setMode] = useState<Mode>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [speedMult, setSpeedMult] = useState<SpeedMult>(1)
  const [uiScore, setUiScore] = useState<[number, number]>([0, 0])
  const [phase, setPhase] = useState<Phase>('idle')
  const [winner, setWinner] = useState<1 | 2 | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const gsRef = useRef<GameState | null>(null)

  const modeRef = useRef<Mode>('menu')
  const diffRef = useRef<Difficulty>('easy')
  const speedMultRef = useRef<SpeedMult>(1)

  const keysRef = useRef({ left1: false, right1: false, left2: false, right2: false })
  const touchRef = useRef<{ p1X: number | null; p2X: number | null }>({ p1X: null, p2X: null })
  const dprRef = useRef(1)

  const playSoundRef = useRef(playSound)
  const updateScoreRef = useRef(updateScore)
  useEffect(() => { playSoundRef.current = playSound }, [playSound])
  useEffect(() => { updateScoreRef.current = updateScore }, [updateScore])

  const initGame = useCallback((m: Mode, d: Difficulty, sm: SpeedMult) => {
    modeRef.current = m
    diffRef.current = d
    speedMultRef.current = sm
    const { p1, p2 } = makePaddles()
    gsRef.current = {
      ball: makeBall(1, sm),
      p1, p2,
      score1: 0,
      score2: 0,
      phase: 'playing',
      particles: [],
      scoredTimer: 0,
      lastScorer: null,
    }
    setUiScore([0, 0])
    setPhase('playing')
    setWinner(null)
  }, [])

  const fireConfetti = useCallback(() => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ['#6BB8FF', '#A78BFA', '#ffffff', '#FCD34D'] })
    setTimeout(() =>
      confetti({ particleCount: 60, spread: 100, origin: { y: 0.3 }, colors: ['#6BB8FF', '#A78BFA', '#ffffff'] }), 400)
  }, [])

  const draw = useCallback((ctx: CanvasRenderingContext2D, gs: GameState) => {
    const dpr = dprRef.current
    ctx.save()
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#0F172A'
    ctx.fillRect(0, 0, W, H)

    ctx.setLineDash([8, 10])
    ctx.strokeStyle = 'rgba(148,163,184,0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(16, H / 2)
    ctx.lineTo(W - 16, H / 2)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.font = `bold 42px 'Fredoka One', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = 'rgba(167,139,250,0.9)'
    ctx.shadowColor = '#A78BFA'
    ctx.shadowBlur = 10
    ctx.fillText(String(gs.score2), W / 2, H / 2 - 44)

    ctx.fillStyle = 'rgba(107,184,255,0.9)'
    ctx.shadowColor = '#6BB8FF'
    ctx.shadowBlur = 10
    ctx.fillText(String(gs.score1), W / 2, H / 2 + 44)
    ctx.shadowBlur = 0

    const drawPaddle = (paddle: Paddle, color: string, glowColor: string) => {
      ctx.shadowColor = glowColor
      ctx.shadowBlur = 18
      const rx = 6
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, rx)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath()
      ctx.roundRect(paddle.x + 4, paddle.y + 2, paddle.w - 8, 4, 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    drawPaddle(gs.p1, '#6BB8FF', '#6BB8FF')
    drawPaddle(gs.p2, '#A78BFA', '#A78BFA')

    ctx.shadowColor = '#FFFFFF'
    ctx.shadowBlur = 20
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(gs.ball.x, gs.ball.y, BALL_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = '#6BB8FF'
    ctx.shadowBlur = 30
    ctx.fillStyle = 'rgba(107,184,255,0.5)'
    ctx.beginPath()
    ctx.arc(gs.ball.x, gs.ball.y, BALL_R + 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    for (const p of gs.particles) {
      ctx.globalAlpha = p.life
      ctx.shadowColor = p.color
      ctx.shadowBlur = 8
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    if (gs.phase === 'scored' && gs.scoredTimer > 0) {
      const alpha = Math.min(1, gs.scoredTimer / 40) * 0.25
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.fillRect(0, 0, W, H)
      const color = gs.lastScorer === 1 ? '#6BB8FF' : '#A78BFA'
      ctx.font = `bold 38px 'Fredoka One', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 20
      ctx.fillText('Ponto!', W / 2, H / 2)
      ctx.shadowBlur = 0
    }

    if (gs.phase === 'paused') {
      ctx.fillStyle = 'rgba(15,23,42,0.75)'
      ctx.fillRect(0, 0, W, H)
      ctx.font = `bold 40px 'Fredoka One', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = '#6BB8FF'
      ctx.shadowBlur = 16
      ctx.fillText('PAUSADO', W / 2, H / 2)
      ctx.shadowBlur = 0
    }

    ctx.restore()
  }, [])

  const tickRef = useRef<() => void>(() => {})
  tickRef.current = () => {
    const gs = gsRef.current
    if (!gs || (gs.phase !== 'playing' && gs.phase !== 'scored')) return

    const sm = speedMultRef.current
    const m = modeRef.current
    const diff = diffRef.current
    const keys = keysRef.current
    const touch = touchRef.current
    const PADDLE_SPEED = 7

    if (touch.p1X !== null) {
      gs.p1.x = clamp(touch.p1X - gs.p1.w / 2, 0, W - gs.p1.w)
    } else {
      if (keys.left1) gs.p1.x = clamp(gs.p1.x - PADDLE_SPEED, 0, W - gs.p1.w)
      if (keys.right1) gs.p1.x = clamp(gs.p1.x + PADDLE_SPEED, 0, W - gs.p1.w)
    }

    if (m === 'duo') {
      if (touch.p2X !== null) {
        gs.p2.x = clamp(touch.p2X - gs.p2.w / 2, 0, W - gs.p2.w)
      } else {
        if (keys.left2) gs.p2.x = clamp(gs.p2.x - PADDLE_SPEED, 0, W - gs.p2.w)
        if (keys.right2) gs.p2.x = clamp(gs.p2.x + PADDLE_SPEED, 0, W - gs.p2.w)
      }
    } else {
      // Easy: fixed slow speed (not scaling with ball) so it stays beatable
      const aiSpeed = diff === 'easy' ? 2.8 : AI_HARD * gs.ball.speed
      const paddleCenter = gs.p2.x + gs.p2.w / 2
      const delta = gs.ball.x - paddleCenter
      if (Math.abs(delta) > 4) {
        gs.p2.x = clamp(gs.p2.x + Math.sign(delta) * aiSpeed, 0, W - gs.p2.w)
      }
    }

    gs.ball.x += gs.ball.vx
    gs.ball.y += gs.ball.vy

    if (gs.ball.x - BALL_R < 0) {
      gs.ball.x = BALL_R
      gs.ball.vx = Math.abs(gs.ball.vx)
    }
    if (gs.ball.x + BALL_R > W) {
      gs.ball.x = W - BALL_R
      gs.ball.vx = -Math.abs(gs.ball.vx)
    }

    const hitPaddle = (paddle: Paddle, ballBelow: boolean): boolean => {
      const bx = gs.ball.x, by = gs.ball.y
      if (bx + BALL_R < paddle.x || bx - BALL_R > paddle.x + paddle.w) return false
      if (ballBelow) {
        if (by - BALL_R > paddle.y + paddle.h) return false
        if (by + BALL_R < paddle.y) return false
        return gs.ball.vy < 0
      } else {
        if (by + BALL_R < paddle.y) return false
        if (by - BALL_R > paddle.y + paddle.h) return false
        return gs.ball.vy > 0
      }
    }

    if (hitPaddle(gs.p1, false)) {
      const relHit = (gs.ball.x - (gs.p1.x + gs.p1.w / 2)) / (gs.p1.w / 2)
      const angle = relHit * 65 * (Math.PI / 180)
      const newSpeed = Math.min(gs.ball.speed + SPEED_INCREMENT * sm, BASE_SPEED * sm * MAX_SPEED_MULT)
      gs.ball.speed = newSpeed
      gs.ball.vy = -Math.cos(angle) * newSpeed
      gs.ball.vx = Math.sin(angle) * newSpeed
      gs.ball.y = gs.p1.y - BALL_R - 1
      gs.particles.push(...spawnParticles(gs.ball.x, gs.p1.y, '#6BB8FF'))
      playSoundRef.current('tick')
    }

    if (hitPaddle(gs.p2, true)) {
      const relHit = (gs.ball.x - (gs.p2.x + gs.p2.w / 2)) / (gs.p2.w / 2)
      const angle = relHit * 65 * (Math.PI / 180)
      const newSpeed = Math.min(gs.ball.speed + SPEED_INCREMENT * sm, BASE_SPEED * sm * MAX_SPEED_MULT)
      gs.ball.speed = newSpeed
      gs.ball.vy = Math.cos(angle) * newSpeed
      gs.ball.vx = Math.sin(angle) * newSpeed
      gs.ball.y = gs.p2.y + gs.p2.h + BALL_R + 1
      gs.particles.push(...spawnParticles(gs.ball.x, gs.p2.y + gs.p2.h, '#A78BFA'))
      playSoundRef.current('tick')
    }

    if (gs.ball.y - BALL_R > H) {
      gs.score2++
      playSoundRef.current('win')
      const s1 = gs.score1, s2 = gs.score2
      setUiScore([s1, s2])
      if (s2 >= WIN_SCORE) {
        gs.phase = 'gameover'
        setPhase('gameover')
        setWinner(2)
        updateScoreRef.current('pong', s1)
        fireConfetti()
        return
      }
      gs.phase = 'scored'
      gs.scoredTimer = 70
      gs.lastScorer = 2
      gs.ball = makeBall(1, sm)
    }

    if (gs.ball.y + BALL_R < 0) {
      gs.score1++
      playSoundRef.current('win')
      const s1 = gs.score1, s2 = gs.score2
      setUiScore([s1, s2])
      if (s1 >= WIN_SCORE) {
        gs.phase = 'gameover'
        setPhase('gameover')
        setWinner(1)
        updateScoreRef.current('pong', s1)
        fireConfetti()
        return
      }
      gs.phase = 'scored'
      gs.scoredTimer = 70
      gs.lastScorer = 1
      gs.ball = makeBall(2, sm)
    }

    gs.particles = gs.particles
      .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.07 }))
      .filter(p => p.life > 0)

    if (gs.phase === 'scored') {
      gs.scoredTimer--
      if (gs.scoredTimer <= 0) gs.phase = 'playing'
    }
  }

  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    dprRef.current = dpr
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
  }, [])

  useEffect(() => {
    if (phase === 'idle' || phase === 'gameover') {
      cancelAnimationFrame(rafRef.current)
      if (phase === 'gameover') {
        const canvas = canvasRef.current
        const gs = gsRef.current
        if (canvas && gs) {
          const ctx = canvas.getContext('2d')
          if (ctx) drawRef.current(ctx, gs)
        }
      }
      return
    }

    let running = true
    const loop = () => {
      if (!running) return
      tickRef.current()
      const canvas = canvasRef.current
      const gs = gsRef.current
      if (canvas && gs) {
        const ctx = canvas.getContext('2d')
        if (ctx) drawRef.current(ctx, gs)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [phase])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const gs = gsRef.current
      switch (e.key) {
        case 'ArrowLeft': keysRef.current.left1 = true; e.preventDefault(); break
        case 'ArrowRight': keysRef.current.right1 = true; e.preventDefault(); break
        case 'a': case 'A': keysRef.current.left2 = true; break
        case 'd': case 'D': keysRef.current.right2 = true; break
        case 'Escape':
          if (!gs) return
          if (gs.phase === 'playing' || gs.phase === 'scored') {
            gs.phase = 'paused'; setPhase('paused')
          } else if (gs.phase === 'paused') {
            gs.phase = 'playing'; setPhase('playing')
          }
          break
      }
    }
    const onUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': keysRef.current.left1 = false; break
        case 'ArrowRight': keysRef.current.right1 = false; break
        case 'a': case 'A': keysRef.current.left2 = false; break
        case 'd': case 'D': keysRef.current.right2 = false; break
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const getCanvasRect = () => canvas.getBoundingClientRect()

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const r = getCanvasRect()
      for (const t of Array.from(e.changedTouches)) {
        const relY = t.clientY - r.top
        const cx = (t.clientX - r.left) * (W / r.width)
        if (relY > r.height / 2) touchRef.current.p1X = cx
        else touchRef.current.p2X = cx
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const r = getCanvasRect()
      for (const t of Array.from(e.changedTouches)) {
        const relY = t.clientY - r.top
        const cx = (t.clientX - r.left) * (W / r.width)
        if (relY > r.height / 2) touchRef.current.p1X = cx
        else touchRef.current.p2X = cx
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      const r = getCanvasRect()
      for (const t of Array.from(e.changedTouches)) {
        const relY = t.clientY - r.top
        if (relY > r.height / 2) touchRef.current.p1X = null
        else touchRef.current.p2X = null
      }
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const togglePause = () => {
    playSound('click')
    const gs = gsRef.current
    if (!gs) return
    if (gs.phase === 'playing' || gs.phase === 'scored') {
      gs.phase = 'paused'; setPhase('paused')
    } else if (gs.phase === 'paused') {
      gs.phase = 'playing'; setPhase('playing')
    }
  }

  const startGame = (m: Mode) => {
    playSound('click')
    setMode(m)
    initGame(m, difficulty, speedMult)
  }

  const restartGame = () => {
    playSound('click')
    initGame(mode, difficulty, speedMult)
  }

  const goMenu = () => {
    playSound('click')
    cancelAnimationFrame(rafRef.current)
    gsRef.current = null
    setPhase('idle')
    setWinner(null)
    setMode('menu')
  }

  const btnDown = (key: keyof typeof keysRef.current) => () => { keysRef.current[key] = true }
  const btnUp = (key: keyof typeof keysRef.current) => () => { keysRef.current[key] = false }

  const p2Label = mode === 'duo' ? 'Jogador 2' : 'Computador'

  return (
    <div className="flex flex-col items-center min-h-screen py-4 px-2 select-none" style={{ fontFamily: 'Nunito, sans-serif' }}>

      <AnimatePresence>
        {mode === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-card p-6 w-full max-w-sm flex flex-col items-center gap-5"
          >
            <div className="text-6xl">🏓</div>
            <h1 className="text-3xl font-bold text-center" style={{ fontFamily: 'Fredoka One, sans-serif', color: '#7B5EA7' }}>
              Ping Pong
            </h1>

            <div className="w-full">
              <p className="text-sm font-semibold mb-1 text-center" style={{ color: '#7B5EA7' }}>Dificuldade da IA</p>
              <div className="flex gap-2">
                {(['easy', 'hard'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => { playSound('click'); setDifficulty(d) }}
                    className={difficulty === d ? 'btn-primary flex-1 py-2 text-sm' : 'btn-secondary flex-1 py-2 text-sm'}
                    style={{ minHeight: 44 }}
                  >
                    {d === 'easy' ? '😊 Fácil' : '😈 Difícil'}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full">
              <p className="text-sm font-semibold mb-1 text-center" style={{ color: '#7B5EA7' }}>Velocidade</p>
              <div className="flex gap-2">
                {([1, 1.5] as SpeedMult[]).map(s => (
                  <button
                    key={s}
                    onClick={() => { playSound('click'); setSpeedMult(s) }}
                    className={speedMult === s ? 'btn-primary flex-1 py-2 text-sm' : 'btn-secondary flex-1 py-2 text-sm'}
                    style={{ minHeight: 44 }}
                  >
                    {s === 1 ? '🐢 Normal' : '⚡ Rápido'}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary w-full py-3 text-lg" style={{ minHeight: 52 }} onClick={() => startGame('solo')}>
              🧍 Vs Computador
            </button>
            <button className="btn-secondary w-full py-3 text-lg" style={{ minHeight: 52 }} onClick={() => startGame('duo')}>
              👥 Dois Jogadores
            </button>
            <button className="btn-secondary w-full py-2 text-sm" style={{ minHeight: 44 }} onClick={() => { playSound('click'); setShowHelp(true) }}>
              ❓ Ajuda
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {mode !== 'menu' && (
        <motion.div
          key="game"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-2 w-full max-w-sm"
        >
          <div className="flex items-center justify-between w-full px-1">
            <button className="btn-secondary px-3 py-1 text-sm" style={{ minHeight: 36 }} onClick={goMenu}>
              ← Menu
            </button>
            <div className="text-center">
              <span className="text-xs font-semibold" style={{ color: '#7B5EA7' }}>
                {p2Label} <span style={{ color: '#A78BFA' }}>{uiScore[1]}</span>
                {' · '}
                Jogador 1 <span style={{ color: '#6BB8FF' }}>{uiScore[0]}</span>
              </span>
            </div>
            <div className="flex gap-1">
              <button
                className="btn-secondary px-3 py-1 text-sm"
                style={{ minHeight: 36 }}
                onClick={() => { playSound('click'); setShowHelp(true) }}
              >❓</button>
              <button
                className="btn-secondary px-3 py-1 text-sm"
                style={{ minHeight: 36 }}
                onClick={togglePause}
              >
                {phase === 'paused' ? '▶' : '⏸'}
              </button>
            </div>
          </div>

          {mode === 'duo' && (
            <div className="flex gap-3 w-full justify-center">
              <button
                className="btn-secondary px-6 py-2 text-lg font-bold"
                style={{ minHeight: 44, touchAction: 'none', userSelect: 'none', color: '#A78BFA', borderColor: '#A78BFA' }}
                onMouseDown={btnDown('left2')} onMouseUp={btnUp('left2')} onMouseLeave={btnUp('left2')}
                onTouchStart={e => { e.preventDefault(); btnDown('left2')() }}
                onTouchEnd={e => { e.preventDefault(); btnUp('left2')() }}
              >◀</button>
              <span className="text-xs self-center font-semibold" style={{ color: '#A78BFA' }}>Jogador 2</span>
              <button
                className="btn-secondary px-6 py-2 text-lg font-bold"
                style={{ minHeight: 44, touchAction: 'none', userSelect: 'none', color: '#A78BFA', borderColor: '#A78BFA' }}
                onMouseDown={btnDown('right2')} onMouseUp={btnUp('right2')} onMouseLeave={btnUp('right2')}
                onTouchStart={e => { e.preventDefault(); btnDown('right2')() }}
                onTouchEnd={e => { e.preventDefault(); btnUp('right2')() }}
              >▶</button>
            </div>
          )}

          <div
            className="rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 0 32px rgba(107,184,255,0.25), 0 0 64px rgba(167,139,250,0.15)', width: '100%', maxWidth: W }}
          >
            <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none', width: '100%', height: 'auto' }} aria-label="Mesa do jogo Rumo ao Alvo" />
          </div>

          <div className="flex gap-3 w-full justify-center">
            <button
              className="btn-secondary px-6 py-2 text-lg font-bold"
              style={{ minHeight: 44, touchAction: 'none', userSelect: 'none', color: '#6BB8FF', borderColor: '#6BB8FF' }}
              onMouseDown={btnDown('left1')} onMouseUp={btnUp('left1')} onMouseLeave={btnUp('left1')}
              onTouchStart={e => { e.preventDefault(); btnDown('left1')() }}
              onTouchEnd={e => { e.preventDefault(); btnUp('left1')() }}
            >◀</button>
            <span className="text-xs self-center font-semibold" style={{ color: '#6BB8FF' }}>Jogador 1</span>
            <button
              className="btn-secondary px-6 py-2 text-lg font-bold"
              style={{ minHeight: 44, touchAction: 'none', userSelect: 'none', color: '#6BB8FF', borderColor: '#6BB8FF' }}
              onMouseDown={btnDown('right1')} onMouseUp={btnUp('right1')} onMouseLeave={btnUp('right1')}
              onTouchStart={e => { e.preventDefault(); btnDown('right1')() }}
              onTouchEnd={e => { e.preventDefault(); btnUp('right1')() }}
            >▶</button>
          </div>

          <button className="btn-danger px-6 py-2 text-sm w-full" style={{ minHeight: 44 }} onClick={restartGame}>
            🔄 Reiniciar
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {phase === 'gameover' && winner !== null && (
          <motion.div
            key="win"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-card p-8 text-center flex flex-col items-center gap-4 w-full max-w-xs"
              initial={{ scale: 0, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <div className="text-6xl">{winner === 1 ? '🏆' : mode === 'duo' ? '🏆' : '💻'}</div>
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'Fredoka One, sans-serif', color: '#7B5EA7' }}>
                {winner === 1
                  ? 'Jogador 1 venceu!'
                  : mode === 'duo'
                    ? 'Jogador 2 venceu!'
                    : 'Computador venceu!'}
              </h2>
              <p className="text-lg font-semibold" style={{ color: '#4A90D9' }}>
                Placar final: {uiScore[0]} × {uiScore[1]}
              </p>
              <div className="flex gap-3 w-full mt-2">
                <button className="btn-primary flex-1 py-3" style={{ minHeight: 48 }} onClick={restartGame}>
                  🔄 Jogar Novamente
                </button>
              </div>
              <button className="btn-secondary w-full py-2" style={{ minHeight: 44 }} onClick={goMenu}>
                ← Menu
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            key="help"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              className="glass-card p-6 w-full max-w-sm flex flex-col gap-3"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-center" style={{ fontFamily: 'Fredoka One, sans-serif', color: '#7B5EA7' }}>
                ❓ Como Jogar
              </h2>
              <ul className="text-sm space-y-2" style={{ color: '#334155' }}>
                <li>🎯 <strong>Objetivo:</strong> Marque 7 pontos para vencer!</li>
                <li>🔵 <strong>Jogador 1 (azul, baixo):</strong> Botões ◀ ▶ na tela ou setas do teclado. No celular, arraste na metade inferior.</li>
                <li>🟣 <strong>Jogador 2 / Computador (roxo, cima):</strong> No modo dois jogadores, botões ◀ ▶ acima do campo ou arraste na metade superior.</li>
                <li>⚡ <strong>Física:</strong> A bola acelera a cada rebatida! Bater na borda do raquete dá mais ângulo à bola.</li>
                <li>⏸ <strong>Pause:</strong> Botão ⏸ ou tecla Esc.</li>
                <li>🎮 <strong>Teclado (2 jogadores):</strong> J1: ← →  |  J2: A D</li>
              </ul>
              <button className="btn-primary w-full py-3 mt-2" style={{ minHeight: 48 }} onClick={() => { playSound('click'); setShowHelp(false) }}>
                Entendido! 👍
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
