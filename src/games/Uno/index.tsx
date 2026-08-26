import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild'
type CardValue = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'skip'|'reverse'|'draw2'|'wild'|'wild4'
interface Card { id: string; color: CardColor; value: CardValue }
interface PlayerState { id: string; name: string; isHuman: boolean; hand: Card[] }
type GamePhase = 'setup' | 'playing' | 'colorPick' | 'won'
type Direction = 1 | -1

// ─── Constants ────────────────────────────────────────────────────────────────
const COLOR_BG: Record<CardColor,string> = { red:'#EF4444', blue:'#3B82F6', green:'#22C55E', yellow:'#EAB308', wild:'#7B5EA7' }
const COLOR_BORDER: Record<CardColor,string> = { red:'#B91C1C', blue:'#1D4ED8', green:'#15803D', yellow:'#A16207', wild:'#4A2882' }
const VALUE_EMOJI: Record<CardValue,string> = {
  '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
  skip:'🚫', reverse:'🔄', draw2:'+2', wild:'🌈', wild4:'+4',
}
const COLORS: CardColor[] = ['red','blue','green','yellow']
const COLOR_LABEL: Record<CardColor,string> = { red:'Vermelho', blue:'Azul', green:'Verde', yellow:'Amarelo', wild:'Curinga' }
const AI_NAMES = ['🤖 Robô A','🤖 Robô B','🤖 Robô C']

// ─── Deck Builder ─────────────────────────────────────────────────────────────
function buildDeck(): Card[] {
  const deck: Card[] = []; let id = 0
  const mk = (color: CardColor, value: CardValue): Card => ({ id: `${id++}`, color, value })
  COLORS.forEach(c => {
    deck.push(mk(c,'0'))
    ;(['1','2','3','4','5','6','7','8','9'] as CardValue[]).forEach(v => { deck.push(mk(c,v)); deck.push(mk(c,v)) })
    ;(['skip','reverse','draw2'] as CardValue[]).forEach(v => { deck.push(mk(c,v)); deck.push(mk(c,v)) })
  })
  for (let i=0;i<4;i++) { deck.push(mk('wild','wild')); deck.push(mk('wild','wild4')) }
  return deck
}
function shuffle<T>(arr: T[]): T[] {
  const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]] }; return a
}
function isPlayable(card: Card, top: Card, activeColor: CardColor): boolean {
  return card.color==='wild' || card.color===activeColor || card.value===top.value
}

// ─── AI Logic ─────────────────────────────────────────────────────────────────
function aiChooseCard(hand: Card[], top: Card, activeColor: CardColor): Card | null {
  const playable = hand.filter(c => isPlayable(c, top, activeColor))
  if (!playable.length) return null
  // Prefer: wild4 > draw2 > skip > reverse > wild > number matching color > other
  const order: CardValue[] = ['wild4','draw2','skip','reverse','wild']
  for (const v of order) {
    const c = playable.find(x => x.value === v)
    if (c) return c
  }
  return playable[Math.floor(Math.random() * playable.length)]
}
function aiChooseColor(): CardColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

// ─── UnoCard Component ────────────────────────────────────────────────────────
function UnoCard({ card, onClick, playable, small, style }: {
  card: Card; onClick?: ()=>void; playable?: boolean; small?: boolean; style?: React.CSSProperties
}) {
  const bg = COLOR_BG[card.color]; const border = COLOR_BORDER[card.color]
  const emoji = VALUE_EMOJI[card.value]
  const w = small ? 40 : 68; const h = small ? 58 : 100
  return (
    <motion.div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-uno-card="true"
      data-playable={Boolean(playable && onClick)}
      aria-label={`${VALUE_EMOJI[card.value]} ${COLOR_LABEL[card.color]}${onClick ? ', jogável' : ''}`}
      onKeyDown={event => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick() } }}
      whileHover={playable && onClick ? { y: -14, scale: 1.12, zIndex: 99 } : {}}
      whileTap={onClick ? { scale: 0.9 } : {}}
      style={{
        width: w, height: h, flexShrink: 0,
        background: `radial-gradient(ellipse at 30% 30%, ${bg}EE, ${border})`,
        border: `3px solid ${border}`, borderRadius: 10,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        cursor: playable && onClick ? 'pointer' : 'default',
        boxShadow: playable && onClick ? `0 6px 18px ${bg}99, 0 0 0 2.5px #FCD34D` : '0 3px 8px rgba(0,0,0,0.25)',
        opacity: onClick && !playable ? 0.4 : 1,
        position:'relative', userSelect:'none', transition:'opacity 0.2s', ...style,
      }}>
      <span style={{ position:'absolute', top:3, left:5, fontSize: small?8:11, fontWeight:900, color:'rgba(255,255,255,0.9)', fontFamily:"'Fredoka One',cursive" }}>{emoji}</span>
      <div style={{ background:'rgba(255,255,255,0.22)', borderRadius:'50%', width: small?22:44, height: small?22:44,
        display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid rgba(255,255,255,0.35)' }}>
        <span style={{ fontSize: small?11: card.value.length>2?16:24, fontWeight:900, color:'white', fontFamily:"'Fredoka One',cursive", textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>{emoji}</span>
      </div>
      <span style={{ position:'absolute', bottom:3, right:5, fontSize: small?8:11, fontWeight:900, color:'rgba(255,255,255,0.9)', fontFamily:"'Fredoka One',cursive", transform:'rotate(180deg)' }}>{emoji}</span>
    </motion.div>
  )
}

function CardBack({ small, style }: { small?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ width: small?40:68, height: small?58:100, flexShrink:0,
      background:'linear-gradient(135deg,#1E1B4B,#312E81,#1E1B4B)', border:'3px solid #4338CA',
      borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow:'0 3px 8px rgba(0,0,0,0.35)', ...style }}>
      <div style={{ width: small?22:42, height: small?32:60, background:'linear-gradient(135deg,#6366F1,#A78BFA)',
        borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid rgba(255,255,255,0.2)' }}>
        <span style={{ fontSize: small?10:18, color:'white', fontWeight:900 }}>UNO</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Uno() {
  const { playSound } = useSound()
  const { playerName, updateScore } = usePlayer()

  const [phase, setPhase] = useState<GamePhase>('setup')
  const [aiCount, setAiCount] = useState(1)
  const [players, setPlayers] = useState<PlayerState[]>([])
  const [drawPile, setDrawPile] = useState<Card[]>([])
  const [discardPile, setDiscardPile] = useState<Card[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [direction, setDirection] = useState<Direction>(1)
  const [activeColor, setActiveColor] = useState<CardColor>('red')
  const [pendingDraw, setPendingDraw] = useState(0)
  const [hasDrawnThisTurn, setHasDrawnThisTurn] = useState(false)
  const [drawnCard, setDrawnCard] = useState<Card | null>(null)
  const [winner, setWinner] = useState<PlayerState | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [showUnoBtn, setShowUnoBtn] = useState(false)
  const [unoCalled, setUnoCalled] = useState<Set<string>>(new Set())
  const [pendingColorCard, setPendingColorCard] = useState<Card | null>(null)
  const [msg, setMsg] = useState('')

  const stateRef = useRef({ players, drawPile, discardPile, currentIdx, direction, activeColor, pendingDraw, hasDrawnThisTurn })
  useEffect(() => {
    stateRef.current = { players, drawPile, discardPile, currentIdx, direction, activeColor, pendingDraw, hasDrawnThisTurn }
  })

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 1800) }

  // ── Initialize game ──────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const deck = shuffle(buildDeck())
    const allPlayers: PlayerState[] = [
      { id: 'human', name: playerName, isHuman: true, hand: deck.splice(0, 7) },
      ...Array.from({ length: aiCount }, (_, i) => ({
        id: `ai-${i}`, name: AI_NAMES[i], isHuman: false, hand: deck.splice(0, 7)
      }))
    ]
    // First discard card: not a wild
    let topIdx = deck.findIndex(c => c.color !== 'wild')
    if (topIdx < 0) topIdx = 0
    const [topCard] = deck.splice(topIdx, 1)
    setPlayers(allPlayers)
    setDrawPile(deck)
    setDiscardPile([topCard])
    setActiveColor(topCard.color as CardColor)
    setCurrentIdx(0)
    setDirection(1)
    setPendingDraw(0)
    setHasDrawnThisTurn(false)
    setDrawnCard(null)
    setWinner(null)
    setUnoCalled(new Set())
    setShowUnoBtn(false)
    setPhase('playing')
  }, [playerName, aiCount])

  // ── Next player helper ───────────────────────────────────────────────────────
  const nextPlayer = useCallback((
    pls: PlayerState[], idx: number, dir: Direction, skip = false
  ) => {
    const count = pls.length
    let next = ((idx + dir) % count + count) % count
    if (skip) next = ((next + dir) % count + count) % count
    return next
  }, [])

  // ── Draw cards from pile ─────────────────────────────────────────────────────
  const drawFromPile = useCallback((pile: Card[], discard: Card[], count: number): [Card[], Card[], Card[]] => {
    let dp = [...pile]
    const drawn: Card[] = []
    for (let i = 0; i < count; i++) {
      if (!dp.length) {
        // reshuffle discard (keep top)
        const top = discard[discard.length - 1]
        dp = shuffle(discard.slice(0, -1))
        discard = [top]
      }
      if (dp.length) drawn.push(dp.pop()!)
    }
    return [drawn, dp, discard]
  }, [])

  // ── Play a card ──────────────────────────────────────────────────────────────
  const playCard = useCallback((playerIdx: number, cardId: string, chosenColor?: CardColor) => {
    const s = stateRef.current
    const pls = s.players.map(p => ({ ...p, hand: [...p.hand] }))
    const player = pls[playerIdx]
    const cardIdx = player.hand.findIndex(c => c.id === cardId)
    if (cardIdx < 0) return

    const card = player.hand.splice(cardIdx, 1)[0]
    const newDiscard = [...s.discardPile, card]
    let newColor: CardColor = card.color === 'wild' ? (chosenColor || 'red') : card.color
    let newDir = s.direction
    let skip = false
    let drawCount = 0

    playSound('card')

    // Apply special effects
    if (card.value === 'reverse') {
      if (pls.length === 2) skip = true // with 2 players, reverse acts like skip
      else newDir = (newDir * -1) as Direction
    }
    if (card.value === 'skip') skip = true
    if (card.value === 'draw2') drawCount = 2
    if (card.value === 'wild4') drawCount = 4

    // Check win
    if (player.hand.length === 0) {
      setPlayers(pls)
      setDiscardPile(newDiscard)
      setActiveColor(newColor)
      setWinner(player)
      setPhase('won')
      playSound('win')
      confetti({ particleCount: 120, spread: 80, colors: ['#6BB8FF','#A78BFA','#FCD34D','#ffffff'] })
      if (player.isHuman) updateScore('uno', pls.length * 10)
      return
    }

    // UNO check
    if (player.hand.length === 1) {
      if (!unoCalled.has(player.id)) {
        if (player.isHuman) setShowUnoBtn(true)
        else {
          // AI auto-calls UNO
          setUnoCalled(prev => new Set([...prev, player.id]))
          showMsg(`${player.name} gritou UNO! 🎉`)
        }
      }
    }

    // Apply draw effects to next player
    let newPls = pls
    let newDraw = [...s.drawPile]
    let newDiscard2 = newDiscard

    let nextIdx = nextPlayer(pls, playerIdx, newDir, skip)

    if (drawCount > 0) {
      const [drawn, dp, dc] = drawFromPile(newDraw, newDiscard2, drawCount)
      newPls = pls.map((p, i) => i === nextIdx ? { ...p, hand: [...p.hand, ...drawn] } : p)
      newDraw = dp
      newDiscard2 = dc
      skip = true // drawing player also loses turn
      nextIdx = nextPlayer(pls, playerIdx, newDir, true)
      showMsg(`${pls[nextIdx === playerIdx ? nextPlayer(pls,playerIdx,newDir,false) : nextIdx].name} comprou ${drawCount}! `)
    }

    setPlayers(newPls)
    setDrawPile(newDraw)
    setDiscardPile(newDiscard2)
    setActiveColor(newColor)
    setDirection(newDir)
    setCurrentIdx(nextIdx)
    setHasDrawnThisTurn(false)
    setDrawnCard(null)
    setShowUnoBtn(false)
  }, [nextPlayer, drawFromPile, playSound, updateScore, unoCalled])

  // ── Human draws a card ───────────────────────────────────────────────────────
  const humanDraw = useCallback(() => {
    if (hasDrawnThisTurn) return
    const s = stateRef.current
    const [drawn, dp, dc] = drawFromPile(s.drawPile, s.discardPile, 1)
    if (!drawn.length) return
    const card = drawn[0]
    const newPls = s.players.map((p, i) =>
      i === s.currentIdx ? { ...p, hand: [...p.hand, card] } : p
    )
    setPlayers(newPls)
    setDrawPile(dp)
    setDiscardPile(dc)
    setHasDrawnThisTurn(true)
    setDrawnCard(card)
    playSound('card')
    // If drawn card is not playable, auto-end turn
    const top = s.discardPile[s.discardPile.length - 1]
    if (!isPlayable(card, top, s.activeColor)) {
      setTimeout(() => {
        setCurrentIdx(nextPlayer(newPls, s.currentIdx, s.direction))
        setHasDrawnThisTurn(false)
        setDrawnCard(null)
      }, 800)
    }
  }, [hasDrawnThisTurn, drawFromPile, playSound, nextPlayer])

  // ── AI turn ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return
    const cur = players[currentIdx]
    if (!cur || cur.isHuman) return
    setAiThinking(true)
    const t = setTimeout(() => {
      const s = stateRef.current
      const top = s.discardPile[s.discardPile.length - 1]
      const card = aiChooseCard(cur.hand, top, s.activeColor)
      if (card) {
        const color = (card.color === 'wild') ? aiChooseColor() : undefined
        if (card.color === 'wild') {
          // Immediately play with chosen color (no modal for AI)
          playCard(currentIdx, card.id, color)
        } else {
          playCard(currentIdx, card.id)
        }
      } else {
        // Draw a card
        const [drawn, dp, dc] = drawFromPile(s.drawPile, s.discardPile, 1)
        if (drawn.length) {
          const drawnCard = drawn[0]
          const newPls = s.players.map((p, i) =>
            i === currentIdx ? { ...p, hand: [...p.hand, drawnCard] } : p
          )
          setPlayers(newPls)
          setDrawPile(dp)
          setDiscardPile(dc)
          // Try to play drawn card
          if (isPlayable(drawnCard, top, s.activeColor)) {
            setTimeout(() => {
              const col = drawnCard.color === 'wild' ? aiChooseColor() : undefined
              playCard(currentIdx, drawnCard.id, col)
            }, 400)
          } else {
            setCurrentIdx(nextPlayer(newPls, currentIdx, s.direction))
          }
        } else {
          setCurrentIdx(nextPlayer(s.players, currentIdx, s.direction))
        }
      }
      setAiThinking(false)
    }, 850 + Math.random() * 300)
    return () => clearTimeout(t)
  }, [currentIdx, players, phase, playCard, humanDraw, drawFromPile, nextPlayer])

  // ── Human plays card ─────────────────────────────────────────────────────────
  const handleHumanPlay = (card: Card) => {
    const s = stateRef.current
    const top = s.discardPile[s.discardPile.length - 1]
    if (!isPlayable(card, top, s.activeColor)) return
    if (card.color === 'wild') {
      setPendingColorCard(card)
      setPhase('colorPick')
    } else {
      playCard(currentIdx, card.id)
    }
  }

  const handleColorPick = (color: CardColor) => {
    if (!pendingColorCard) return
    setPhase('playing')
    playCard(currentIdx, pendingColorCard.id, color)
    setPendingColorCard(null)
  }

  const handleUnoClick = () => {
    setUnoCalled(prev => new Set([...prev, players[currentIdx].id]))
    setShowUnoBtn(false)
    playSound('match')
    showMsg('UNO! 🎉')
  }

  const handlePassTurn = () => {
    const s = stateRef.current
    setCurrentIdx(nextPlayer(s.players, s.currentIdx, s.direction))
    setHasDrawnThisTurn(false)
    setDrawnCard(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  const topCard = discardPile[discardPile.length - 1]
  const human = players[0]
  const aiPlayers = players.slice(1)
  const isHumanTurn = phase === 'playing' && currentIdx === 0
  const humanPlayable = human?.hand.filter(c => topCard && isPlayable(c, topCard, activeColor)) ?? []

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4">
        <h1 className="font-title text-4xl text-center mb-1" style={{ color: '#7B5EA7' }}>UNO 🃏</h1>
        <p className="text-center text-sm mb-6" style={{ color: '#6BB8FF' }}>Esvazie sua mão primeiro!</p>
        <div className="glass-card p-6 max-w-xs mx-auto space-y-5">
          <div>
            <p className="font-bold mb-3" style={{ color: '#7B5EA7' }}>🤖 Quantos robôs?</p>
            <div className="flex gap-3 justify-center">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setAiCount(n)}
                  className="w-14 h-14 rounded-2xl font-title text-2xl transition-all active:scale-90"
                  style={{ background: aiCount === n ? 'linear-gradient(135deg,#6BB8FF,#A78BFA)' : 'rgba(167,139,250,0.1)',
                    color: aiCount === n ? 'white' : '#7B5EA7', border: aiCount === n ? 'none' : '2px solid #C4B5FD' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary w-full" onClick={startGame}>🎮 Jogar!</button>
          <button className="btn-secondary w-full" onClick={() => setShowHelp(true)}>❓ Como jogar</button>
        </div>
        <AnimatePresence>{showHelp && <HelpModal onClose={() => setShowHelp(false)} />}</AnimatePresence>
      </motion.div>
    )
  }

  // ── Win screen ───────────────────────────────────────────────────────────────
  if (phase === 'won' && winner) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="glass-card p-8 max-w-xs mx-auto">
          <div className="text-6xl mb-3">{winner.isHuman ? '🏆' : '🤖'}</div>
          <h2 className="font-title text-3xl mb-2" style={{ color: '#7B5EA7' }}>
            {winner.isHuman ? 'Você Venceu!' : `${winner.name} Venceu!`}
          </h2>
          <p className="mb-6 text-sm" style={{ color: '#6BB8FF' }}>
            {winner.isHuman ? '🎉 Parabéns! Você ficou sem cartas!' : 'Que pena! Tente de novo!'}
          </p>
          <div className="flex gap-3">
            <button className="btn-primary flex-1" onClick={startGame}>🔄 Revanche</button>
            <button className="btn-secondary" onClick={() => setPhase('setup')}>Menu</button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // ── Color picker ─────────────────────────────────────────────────────────────
  if (phase === 'colorPick') {
    return (
      <div className="py-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-6 max-w-xs mx-auto text-center">
          <h2 className="font-title text-2xl mb-4" style={{ color: '#7B5EA7' }}>🌈 Escolha a cor!</h2>
          <div className="grid grid-cols-2 gap-3">
            {COLORS.map(c => (
              <button key={c} onClick={() => handleColorPick(c)}
                className="py-4 rounded-2xl font-bold text-white text-lg active:scale-90 transition-transform"
                style={{ background: COLOR_BG[c], boxShadow: `0 4px 12px ${COLOR_BG[c]}80` }}>
                {COLOR_LABEL[c]}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Main game screen ─────────────────────────────────────────────────────────
  return (
    <div className="py-2 game-area select-none" style={{ maxWidth: 420, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="font-title text-2xl" style={{ color: '#7B5EA7' }}>UNO</span>
          <div className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: `${COLOR_BG[activeColor]}22`, color: COLOR_BG[activeColor], border: `1.5px solid ${COLOR_BG[activeColor]}` }}>
            {COLOR_LABEL[activeColor]}
          </div>
        </div>
        <div className="flex gap-2">
          {isHumanTurn && showUnoBtn && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }}
              onClick={handleUnoClick} className="font-title text-sm px-3 py-1.5 rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', boxShadow: '0 0 15px #EF444480' }}>
              UNO! 📢
            </motion.button>
          )}
          <button onClick={() => setShowHelp(true)} className="btn-secondary text-sm px-3 py-1.5">❓</button>
        </div>
      </div>

      {/* AI Players */}
      <div className="space-y-2 mb-3">
        {aiPlayers.map((ai, i) => {
          const isActive = currentIdx === i + 1
          return (
            <div key={ai.id} className="glass-card px-4 py-2 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: isActive ? '#7B5EA7' : '#9CA3AF' }}>{ai.name}</span>
                  {isActive && aiThinking && (
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
                      className="text-xs" style={{ color: '#A78BFA' }}>pensando...</motion.span>
                  )}
                  {isActive && !aiThinking && <span className="text-xs" style={{ color: '#6BB8FF' }}>▶ vez</span>}
                </div>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>{ai.hand.length} cartas</p>
              </div>
              <div className="flex gap-0.5">
                {ai.hand.slice(0, Math.min(ai.hand.length, 7)).map((_, ci) => (
                  <CardBack key={ci} small style={{ width: 24, height: 36, borderRadius: 5 }} />
                ))}
                {ai.hand.length > 7 && <span className="text-xs self-end" style={{ color: '#9CA3AF' }}>+{ai.hand.length - 7}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Center area: draw pile + discard */}
      <div className="flex items-center justify-center gap-6 mb-3">
        <div className="text-center">
          <p className="text-xs mb-1 font-bold" style={{ color: '#9CA3AF' }}>Comprar</p>
          <motion.div onClick={isHumanTurn && !hasDrawnThisTurn ? humanDraw : undefined}
            whileTap={isHumanTurn && !hasDrawnThisTurn ? { scale: 0.9 } : {}}
            style={{ cursor: isHumanTurn && !hasDrawnThisTurn ? 'pointer' : 'default', opacity: hasDrawnThisTurn ? 0.5 : 1 }}>
            <CardBack />
          </motion.div>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{drawPile.length}</p>
        </div>

        <div className="text-center">
          <p className="text-xs mb-1 font-bold" style={{ color: '#9CA3AF' }}>Descarte</p>
          {topCard && (
            <motion.div key={topCard.id} initial={{ scale: 0.7, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}>
              <UnoCard card={{ ...topCard, color: activeColor }} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-center font-bold mb-2" style={{ color: '#7B5EA7' }}>{msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Human hand */}
      {human && (
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm" style={{ color: isHumanTurn ? '#7B5EA7' : '#9CA3AF' }}>
              {isHumanTurn ? '🌟 Sua vez!' : `🕐 Aguarde...`} — {human.hand.length} cartas
            </span>
            {isHumanTurn && hasDrawnThisTurn && drawnCard && isPlayable(drawnCard, topCard, activeColor) && (
              <button onClick={handlePassTurn} className="btn-secondary text-xs px-3 py-1">Passar</button>
            )}
            {isHumanTurn && hasDrawnThisTurn && drawnCard && !isPlayable(drawnCard, topCard, activeColor) && (
              <span className="text-xs" style={{ color: '#9CA3AF' }}>Passando...</span>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {human.hand.map(card => {
              const playable = isHumanTurn && !hasDrawnThisTurn && isPlayable(card, topCard, activeColor)
              const isJustDrawn = hasDrawnThisTurn && drawnCard?.id === card.id
              const canPlayDrawn = isJustDrawn && isPlayable(card, topCard, activeColor)
              return (
                <motion.div key={card.id} layout initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <UnoCard
                    card={card}
                    onClick={playable || canPlayDrawn ? () => handleHumanPlay(card) : undefined}
                    playable={playable || canPlayDrawn}
                    style={isJustDrawn ? { outline: '2px solid #FCD34D', borderRadius: 10 } : {}}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      <AnimatePresence>{showHelp && <HelpModal onClose={() => setShowHelp(false)} />}</AnimatePresence>
    </div>
  )
}

// ─── Help Modal ───────────────────────────────────────────────────────────────
function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
        className="glass-card p-6" style={{ maxWidth:380, width:'100%', maxHeight:'88vh', overflowY:'auto' }}>
        <h2 className="font-title text-2xl mb-3" style={{ color:'#7B5EA7' }}>❓ Como Jogar UNO</h2>
        <div style={{ color:'#374151', fontSize:'0.88rem', lineHeight:1.7, display:'flex', flexDirection:'column', gap:8 }}>
          <p>🎯 <strong>Objetivo:</strong> Seja o primeiro a ficar sem cartas!</p>
          <p>✅ <strong>Jogar:</strong> Clique em uma carta válida — mesma cor, mesmo número ou Curinga.</p>
          <p>🃏 <strong>Comprar:</strong> Sem carta válida? Clique na pilha de compra.</p>
          <p>🚫 <strong>Pular:</strong> O próximo jogador perde a vez.</p>
          <p>🔄 <strong>Inverter:</strong> A direção do jogo inverte.</p>
          <p>+2 <strong>Comprar 2:</strong> Próximo compra 2 e perde a vez.</p>
          <p>🌈 <strong>Curinga:</strong> Escolha qualquer cor.</p>
          <p>+4 <strong>Curinga +4:</strong> Próximo compra 4, você escolhe a cor.</p>
          <p>📢 <strong>UNO!</strong> Clique em UNO quando tiver 2 cartas, antes de jogar a penúltima!</p>
        </div>
        <button className="btn-primary w-full mt-4" onClick={onClose}>Entendi! 👍</button>
      </motion.div>
    </motion.div>
  )
}
