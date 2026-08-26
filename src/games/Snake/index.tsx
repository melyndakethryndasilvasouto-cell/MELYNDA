import { useEffect, useRef, useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"
import { useSound } from "../../contexts/SoundContext"
import { usePlayer } from "../../contexts/PlayerContext"

type Point = { x: number; y: number }
type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT"
type GameState = "idle" | "playing" | "paused" | "gameover"

const GRID = 20
const BASE_INTERVAL = 150
const SPEED_STEP = 5
const SPECIAL_DURATION = 8000
const GAME_KEY = "snake"
const LS_BEST = "snake_best"

const randomCell = (): Point => ({
  x: Math.floor(Math.random() * GRID),
  y: Math.floor(Math.random() * GRID),
})

const randomCellExcluding = (exclude: Point[]): Point => {
  let p: Point
  do { p = randomCell() }
  while (exclude.some(e => e.x === p.x && e.y === p.y))
  return p
}

const opposite: Record<Dir, Dir> = {
  UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT",
}

const dirVec: Record<Dir, Point> = {
  UP:    { x: 0, y: -1 },
  DOWN:  { x: 0, y: 1 },
  LEFT:  { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}

const initialSnake = (): Point[] => [
  { x: 10, y: 10 },
  { x: 9,  y: 10 },
  { x: 8,  y: 10 },
]

export default function Snake() {
  const { playSound } = useSound()
  const { updateScore } = usePlayer()

  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const stateRef       = useRef<GameState>("idle")
  const snakeRef       = useRef<Point[]>(initialSnake())
  const dirRef         = useRef<Dir>("RIGHT")
  const foodRef        = useRef<Point>(randomCell())
  const specialRef     = useRef<Point | null>(null)
  const specialTimer   = useRef<number>(0)
  const scoreRef       = useRef<number>(0)
  const bestRef        = useRef<number>(parseInt(localStorage.getItem(LS_BEST) ?? "0"))
  const lastTickRef    = useRef<number>(0)
  const rafRef         = useRef<number>(0)
  const cellRef        = useRef<number>(0)
  const touchStartRef  = useRef<Point | null>(null)
  const pendingDirRef  = useRef<Dir[]>([])
  const containerRef   = useRef<HTMLDivElement>(null)

  const [gameState, setGameState] = useState<GameState>("idle")
  const [score, setScore]         = useState(0)
  const [best, setBest]           = useState(bestRef.current)
  const [showHelp, setShowHelp]   = useState(false)
  const [canvasSize, setCanvasSize] = useState(360)

  useEffect(() => {
    const measure = () => {
      const w = Math.min(containerRef.current?.clientWidth ?? 360, 380)
      setCanvasSize(w)
      cellRef.current = Math.floor(w / GRID)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const cell = cellRef.current
    const w = canvas.width
    const h = canvas.height

    ctx.fillStyle = "#0F172A"
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = "rgba(255,255,255,0.04)"
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        ctx.beginPath()
        ctx.arc(gx * cell + cell / 2, gy * cell + cell / 2, 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const f = foodRef.current
    ctx.fillStyle = "#EF4444"
    ctx.beginPath()
    ctx.arc(f.x * cell + cell / 2, f.y * cell + cell / 2, cell / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.beginPath()
    ctx.arc(f.x * cell + cell / 2 - cell * 0.12, f.y * cell + cell / 2 - cell * 0.12, cell * 0.13, 0, Math.PI * 2)
    ctx.fill()

    const sp = specialRef.current
    if (sp) {
      const px = sp.x * cell + cell / 2
      const py = sp.y * cell + cell / 2
      const r = cell / 2 - 1
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r)
      grad.addColorStop(0, "#DDD6FE")
      grad.addColorStop(1, "#7B5EA7")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `${Math.round(cell * 0.65)}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("\u2B50", px, py)
    }

    const snake = snakeRef.current
    snake.forEach((seg, i) => {
      const sx = seg.x * cell
      const sy = seg.y * cell
      const radius = cell / 2 - 1

      if (i === 0) {
        const hg = ctx.createRadialGradient(
          sx + cell / 2, sy + cell / 2, 0,
          sx + cell / 2, sy + cell / 2, cell
        )
        hg.addColorStop(0, "#93D0FF")
        hg.addColorStop(1, "#6BB8FF")
        ctx.fillStyle = hg
      } else {
        const t = i / Math.max(snake.length, 1)
        const r = Math.round(107 - 33 * t)
        const g = Math.round(184 - 40 * t)
        const b = Math.round(255 - 38 * t)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      }

      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(sx + 1, sy + 1, cell - 2, cell - 2, radius)
      } else {
        ctx.rect(sx + 1, sy + 1, cell - 2, cell - 2)
      }
      ctx.fill()

      if (i === 0) {
        const dir = dirRef.current
        let ex1: Point, ex2: Point
        const e = cell * 0.22
        const d = cell * 0.3
        if (dir === "RIGHT") { ex1 = { x: sx + cell - d, y: sy + e }; ex2 = { x: sx + cell - d, y: sy + cell - e } }
        else if (dir === "LEFT") { ex1 = { x: sx + d, y: sy + e }; ex2 = { x: sx + d, y: sy + cell - e } }
        else if (dir === "UP")   { ex1 = { x: sx + e, y: sy + d }; ex2 = { x: sx + cell - e, y: sy + d } }
        else                     { ex1 = { x: sx + e, y: sy + cell - d }; ex2 = { x: sx + cell - e, y: sy + cell - d } }
        ctx.fillStyle = "#0F172A"
        ctx.beginPath(); ctx.arc(ex1.x, ex1.y, cell * 0.1, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(ex2.x, ex2.y, cell * 0.1, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = "white"
        ctx.beginPath(); ctx.arc(ex1.x - 0.5, ex1.y - 0.5, cell * 0.04, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(ex2.x - 0.5, ex2.y - 0.5, cell * 0.04, 0, Math.PI * 2); ctx.fill()
      }
    })
  }, [])

  const endGame = useCallback(() => {
    stateRef.current = "gameover"
    setGameState("gameover")
    cancelAnimationFrame(rafRef.current)

    const sc = scoreRef.current
    const prev = bestRef.current
    if (sc > prev) {
      bestRef.current = sc
      setBest(sc)
      localStorage.setItem(LS_BEST, String(sc))
      updateScore(GAME_KEY, sc)
      playSound("win")
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#6BB8FF","#A78BFA","#ffffff","#FCD34D"] })
    } else {
      playSound("lose" as Parameters<typeof playSound>[0])
    }
    draw()
  }, [draw, playSound, updateScore])

  const tick = useCallback((now: number) => {
    if (stateRef.current !== "playing") return
    const interval = Math.max(60, BASE_INTERVAL - Math.floor(scoreRef.current / 5) * SPEED_STEP)

    if (now - lastTickRef.current >= interval) {
      lastTickRef.current = now

      if (pendingDirRef.current.length > 0) {
        const nd = pendingDirRef.current.shift()!
        if (nd !== opposite[dirRef.current]) dirRef.current = nd
      }

      const dir = dirRef.current
      const snake = snakeRef.current
      const head = snake[0]
      const vec = dirVec[dir]
      const newHead: Point = { x: head.x + vec.x, y: head.y + vec.y }

      if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
        endGame(); return
      }
      if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        endGame(); return
      }

      let grow = false
      let pts = 0

      if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
        grow = true; pts = 1
        playSound("match")
        const avoid = [...snake, ...(specialRef.current ? [specialRef.current] : [])]
        foodRef.current = randomCellExcluding(avoid)
        if (!specialRef.current && Math.random() < 0.2) {
          specialRef.current = randomCellExcluding([...snake, foodRef.current])
          specialTimer.current = performance.now() + SPECIAL_DURATION
        }
      }

      if (specialRef.current && newHead.x === specialRef.current.x && newHead.y === specialRef.current.y) {
        grow = true; pts += 5
        playSound("match")
        specialRef.current = null
      }

      if (specialRef.current && performance.now() > specialTimer.current) {
        specialRef.current = null
      }

      const newSnake = [newHead, ...snake]
      if (!grow) newSnake.pop()
      snakeRef.current = newSnake

      if (pts > 0) {
        scoreRef.current += pts
        setScore(scoreRef.current)
      }
    }

    draw()
    rafRef.current = requestAnimationFrame(tick)
  }, [draw, endGame, playSound])

  const startGame = useCallback(() => {
    snakeRef.current = initialSnake()
    dirRef.current   = "RIGHT"
    pendingDirRef.current = []
    scoreRef.current = 0
    specialRef.current = null
    foodRef.current  = randomCellExcluding(initialSnake())
    lastTickRef.current = 0
    setScore(0)
    stateRef.current = "playing"
    setGameState("playing")
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const togglePause = useCallback(() => {
    playSound("click")
    if (stateRef.current === "playing") {
      stateRef.current = "paused"
      setGameState("paused")
      cancelAnimationFrame(rafRef.current)
    } else if (stateRef.current === "paused") {
      stateRef.current = "playing"
      setGameState("playing")
      lastTickRef.current = 0
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick, playSound])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const enqueueDir = useCallback((d: Dir) => {
    if (stateRef.current !== "playing") return
    const queue = pendingDirRef.current
    const last = queue.length > 0 ? queue[queue.length - 1] : dirRef.current
    if (d !== last && d !== opposite[last]) {
      if (queue.length < 2) queue.push(d)
      playSound("click")
    }
  }, [playSound])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: "UP", w: "UP", W: "UP",
        ArrowDown: "DOWN", s: "DOWN", S: "DOWN",
        ArrowLeft: "LEFT", a: "LEFT", A: "LEFT",
        ArrowRight: "RIGHT", d: "RIGHT", D: "RIGHT",
      }
      if (map[e.key]) { e.preventDefault(); enqueueDir(map[e.key]) }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") togglePause()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enqueueDir, togglePause])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
    if (Math.abs(dx) > Math.abs(dy)) { enqueueDir(dx > 0 ? "RIGHT" : "LEFT") }
    else { enqueueDir(dy > 0 ? "DOWN" : "UP") }
    touchStartRef.current = null
  }

  useEffect(() => {
    if (gameState !== "playing") draw()
  }, [gameState, draw, canvasSize])

  const DPadBtn = ({ dir, label }: { dir: Dir; label: string }) => (
    <button
      aria-label={`Mover ${dir}`}
      className="flex items-center justify-center rounded-2xl text-white font-bold text-xl select-none active:scale-90 transition-transform"
      style={{
        width: 60, height: 60,
        background: "rgba(107,184,255,0.18)",
        border: "2px solid rgba(107,184,255,0.4)",
        backdropFilter: "blur(4px)",
        touchAction: "manipulation",
      }}
      onPointerDown={e => { e.preventDefault(); enqueueDir(dir) }}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col items-center gap-3 pb-6 px-2 w-full max-w-md mx-auto">

      <div className="flex items-center justify-between w-full px-1 pt-2">
        <div className="glass-card px-4 py-2 flex gap-4 text-sm font-bold">
          <span style={{ color: "#6BB8FF" }}>Pontos: <span className="text-white">{score}</span></span>
          <span style={{ color: "#A78BFA" }}>Recorde: <span className="text-white">{best}</span></span>
        </div>
        <div className="flex gap-2">
          {(gameState === "playing" || gameState === "paused") && (
            <button className="btn-secondary px-3 py-2 text-sm" onClick={togglePause}>
              {gameState === "paused" ? "\u25B6 Continuar" : "\u23F8 Pausar"}
            </button>
          )}
          <button
            className="btn-secondary px-3 py-2 text-sm"
            onClick={() => { playSound("click"); setShowHelp(true) }}
          >
            \u2753 Ajuda
          </button>
        </div>
      </div>

      <div ref={containerRef} className="w-full" style={{ maxWidth: 380 }}>
        <div className="relative rounded-3xl overflow-hidden" style={{ background: "#0F172A", boxShadow: "0 8px 32px rgba(107,184,255,0.25)" }}>
          <canvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            style={{ display: "block", width: canvasSize, height: canvasSize, touchAction: "none" }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />

          <AnimatePresence>
            {gameState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(15,23,42,0.88)" }}
              >
                <div className="text-6xl">\uD83D\uDC0D</div>
                <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Fredoka One'" }}>Cobrinha</h1>
                <p className="text-sm text-center px-6" style={{ color: "#93C5FD" }}>
                  Come a comida, cresça e não bata nas paredes!<br />
                  <span style={{ color: "#C4B5FD" }}>\u2B50 Comida especial vale 5 pontos!</span>
                </p>
                <button className="btn-primary px-8 py-3 text-lg" onClick={() => { playSound("click"); startGame() }}>
                  Jogar
                </button>
              </motion.div>
            )}

            {gameState === "paused" && (
              <motion.div
                key="paused"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(15,23,42,0.85)" }}
              >
                <div className="text-5xl">\u23F8</div>
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Fredoka One'" }}>Pausado</h2>
                <button className="btn-primary px-8 py-3" onClick={togglePause}>\u25B6 Continuar</button>
                <button className="btn-secondary px-6 py-2 text-sm" onClick={() => { playSound("click"); startGame() }}>\uD83D\uDD04 Reiniciar</button>
              </motion.div>
            )}

            {gameState === "gameover" && (
              <motion.div
                key="gameover"
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6"
                style={{ background: "rgba(15,23,42,0.92)" }}
              >
                <div className="text-5xl">{score > 0 && score === best ? "\uD83C\uDFC6" : "\uD83D\uDC80"}</div>
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Fredoka One'" }}>
                  {score === best && score > 0 ? "Novo Recorde!" : "Fim de Jogo!"}
                </h2>
                <div className="glass-card px-6 py-3 text-center w-full">
                  <p className="text-white text-lg font-bold">Pontuação: <span style={{ color: "#6BB8FF" }}>{score}</span></p>
                  <p className="text-sm" style={{ color: "#A78BFA" }}>Recorde: {best}</p>
                </div>
                <button className="btn-primary w-full py-3 text-lg" onClick={() => { playSound("click"); startGame() }}>
                  \uD83D\uDD04 Jogar Novamente
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 mt-2" style={{ userSelect: "none" }}>
        <DPadBtn dir="UP" label="\u2191" />
        <div className="flex gap-4">
          <DPadBtn dir="LEFT" label="\u2190" />
          <DPadBtn dir="DOWN" label="\u2193" />
          <DPadBtn dir="RIGHT" label="\u2192" />
        </div>
      </div>

      <p className="text-xs text-center mt-1" style={{ color: "#94A3B8" }}>
        Use as setas do teclado, WASD ou arraste na tela
      </p>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            key="help-bg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="glass-card p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4 text-center" style={{ fontFamily: "'Fredoka One'", color: "#7B5EA7" }}>
                \uD83D\uDCCB Como Jogar
              </h2>
              <ul className="space-y-3 text-sm" style={{ color: "#334155" }}>
                <li>\uD83D\uDC0D <strong>Mova a cobra</strong> usando as setas do teclado, WASD, os botões na tela ou arrastando.</li>
                <li>\uD83C\uDF4E <strong>Coma a comida vermelha</strong> para crescer e ganhar <strong>1 ponto</strong>.</li>
                <li>\u2B50 <strong>Comida especial roxa</strong> aparece às vezes e vale <strong>5 pontos</strong> — mas some em 8 segundos!</li>
                <li>\uD83D\uDCA5 <strong>Não bata</strong> nas paredes nem em si mesma ou o jogo acaba!</li>
                <li>\u26A1 A cada 5 pontos a cobra fica <strong>mais rápida</strong>.</li>
                <li>\u23F8 Pressione <strong>Pausar</strong> ou a tecla <strong>P</strong> para pausar o jogo.</li>
              </ul>
              <button className="btn-primary w-full mt-5" onClick={() => { playSound("click"); setShowHelp(false) }}>
                Entendido!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
