import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSound } from '../../contexts/SoundContext'
import { OnlinePlayer } from '../../online/types'

type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild'
type CardValue = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'skip'|'reverse'|'draw2'|'wild'|'wild4'
interface Card { id: string; color: CardColor; value: CardValue }
interface PlayerState { id: string; name: string; isHost: boolean; hand: Card[] }
type Direction = 1 | -1

const COLOR_BG: Record<CardColor,string> = { red:'#EF4444', blue:'#3B82F6', green:'#22C55E', yellow:'#EAB308', wild:'#7B5EA7' }
const COLOR_BORDER: Record<CardColor,string> = { red:'#B91C1C', blue:'#1D4ED8', green:'#15803D', yellow:'#A16207', wild:'#4A2882' }
const VALUE_EMOJI: Record<CardValue,string> = {
  '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
  skip:'⃠', reverse:'🔁', draw2:'+2', wild:'🌈', wild4:'+4',
}
const COLORS: CardColor[] = ['red','blue','green','yellow']

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

function UnoCard({ card, onClick, playable, small, style }: { card: Card; onClick?: ()=>void; playable?: boolean; small?: boolean; style?: React.CSSProperties }) {
  const bg = COLOR_BG[card.color]; const border = COLOR_BORDER[card.color]
  const emoji = VALUE_EMOJI[card.value]
  const w = small ? 40 : 68; const h = small ? 58 : 100
  return (
    <motion.div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
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
      <span style={{ position:'absolute', top:3, left:5, fontSize: small?8:11, fontWeight:900, color:'rgba(255,255,255,0.9)' }}>{emoji}</span>
      <div style={{ background:'rgba(255,255,255,0.22)', borderRadius:'50%', width: small?22:44, height: small?22:44, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid rgba(255,255,255,0.35)' }}>
        <span style={{ fontSize: small?11: card.value.length>2?16:24, fontWeight:900, color:'white' }}>{emoji}</span>
      </div>
      <span style={{ position:'absolute', bottom:3, right:5, fontSize: small?8:11, fontWeight:900, color:'rgba(255,255,255,0.9)', transform:'rotate(180deg)' }}>{emoji}</span>
    </motion.div>
  )
}

function CardBack({ small, style }: { small?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ width: small?40:68, height: small?58:100, flexShrink:0, background:'linear-gradient(135deg,#1E1B4B,#312E81,#1E1B4B)', border:'3px solid #4338CA', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 3px 8px rgba(0,0,0,0.35)', ...style }}>
      <div style={{ width: small?22:42, height: small?32:60, background:'linear-gradient(135deg,#6366F1,#A78BFA)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid rgba(255,255,255,0.2)' }}>
        <span style={{ fontSize: small?10:18, color:'white', fontWeight:900 }}>UNO</span>
      </div>
    </div>
  )
}

type Phase = 'config' | 'playing' | 'round_end' | 'match_end'

interface GS {
  phase: Phase
  bestOf: number
  hostScore: number
  guestScore: number
  matchWinner: 'host' | 'guest' | 'draw' | null
  roundWinner: 'host' | 'guest' | 'draw' | null

  deck: Card[]
  discard: Card[]
  players: PlayerState[] // idx 0 = host, idx 1 = guest
  turnIdx: number
  direction: Direction
  activeColor: CardColor
  pendingDraw: number
  hasDrawnThisTurn: boolean
  drawnCardId: string | null
  pendingColorPicker: number | null
  msg: string
  unoCalled: string[] // player ids
}

const INIT_GS: GS = {
  phase: 'config', bestOf: 3, hostScore: 0, guestScore: 0, matchWinner: null, roundWinner: null,
  deck: [], discard: [], players: [], turnIdx: 0, direction: 1, activeColor: 'red', pendingDraw: 0,
  hasDrawnThisTurn: false, drawnCardId: null, pendingColorPicker: null, msg: '', unoCalled: []
}

type Props = {
  isHost: boolean
  roomStatus: 'waiting' | 'active' | 'finished' | 'cancelled'
  opponent: OnlinePlayer | null
  broadcastGameState: any
  guestMove: any
  stateRequest: number
  onBroadcastState: (s: any) => void
  onBroadcastMove: (m: any) => void
  onFinish: (winner: string) => void
}

export default function OnlineUnoBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, stateRequest, onBroadcastState, onBroadcastMove, onFinish }: Props) {
  const { playSound } = useSound()
  const [gs, setGs] = useState<GS>(INIT_GS)
  const initRef = useRef(false)
  const stateRef = useRef(gs)
  stateRef.current = gs

  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initRef.current) return
    initRef.current = true
    setGs(INIT_GS)
    onBroadcastState(INIT_GS)
  }, [isHost, roomStatus, onBroadcastState])

  useEffect(() => {
    if (!isHost && broadcastGameState) {
      setGs(broadcastGameState as GS)
    }
  }, [isHost, broadcastGameState])

  useEffect(() => {
    if (isHost && stateRequest > 0 && initRef.current) onBroadcastState(stateRef.current)
  }, [isHost, onBroadcastState, stateRequest])

  const drawCards = (deck: Card[], discard: Card[], count: number): { drawn: Card[], newDeck: Card[], newDiscard: Card[] } => {
    let currentDeck = [...deck]
    let currentDiscard = [...discard]
    const drawn = []
    for(let i=0; i<count; i++) {
      if (currentDeck.length === 0) {
        if (currentDiscard.length <= 1) break // nowhere to draw from
        const top = currentDiscard.pop()!
        currentDeck = shuffle(currentDiscard)
        currentDiscard = [top]
      }
      drawn.push(currentDeck.pop()!)
    }
    return { drawn, newDeck: currentDeck, newDiscard: currentDiscard }
  }

  const applyMove = useCallback((move: any, pIdx: number) => {
    setGs(prev => {
      if (prev.phase !== 'playing') return prev
      if (prev.pendingColorPicker !== null) {
        if (move.type === 'color' && pIdx === prev.pendingColorPicker) {
          const nextIdx = (prev.turnIdx + prev.direction + 2) % 2
          const nextGs = { ...prev, activeColor: move.color, pendingColorPicker: null, turnIdx: nextIdx, hasDrawnThisTurn: false, drawnCardId: null }
          onBroadcastState(nextGs)
          return nextGs
        }
        return prev
      }

      if (pIdx !== prev.turnIdx) return prev

      if (move.type === 'draw') {
        if (prev.hasDrawnThisTurn) return prev
        const { drawn, newDeck, newDiscard } = drawCards(prev.deck, prev.discard, 1)
        if (drawn.length === 0) return prev // can't draw
        const newPlayers = [...prev.players]
        newPlayers[pIdx] = { ...newPlayers[pIdx], hand: [...newPlayers[pIdx].hand, ...drawn] }
        
        const nextGs = { ...prev, deck: newDeck, discard: newDiscard, players: newPlayers, hasDrawnThisTurn: true, drawnCardId: drawn[0].id }
        onBroadcastState(nextGs)
        playSound('card')
        return nextGs
      }

      if (move.type === 'pass') {
        if (!prev.hasDrawnThisTurn) return prev
        const nextIdx = (prev.turnIdx + prev.direction + 2) % 2
        const nextGs = { ...prev, turnIdx: nextIdx, hasDrawnThisTurn: false, drawnCardId: null }
        onBroadcastState(nextGs)
        return nextGs
      }

      if (move.type === 'play') {
        const pHand = prev.players[pIdx].hand
        const cIdx = pHand.findIndex(c => c.id === move.cardId)
        if (cIdx < 0) return prev
        const card = pHand[cIdx]
        const topCard = prev.discard[prev.discard.length - 1]
        
        if (!isPlayable(card, topCard, prev.activeColor)) return prev

        const newHand = [...pHand]
        newHand.splice(cIdx, 1)
        const newPlayers = [...prev.players]
        newPlayers[pIdx] = { ...newPlayers[pIdx], hand: newHand }

        let newDeck = [...prev.deck]
        let newDiscard = [...prev.discard, card]
        let nextDir = prev.direction
        let nextPendingDraw = prev.pendingDraw
        let nextIdx = (prev.turnIdx + prev.direction + 2) % 2
        let pendingColorPicker = null
        let newActiveColor = prev.activeColor

        playSound('card')

        // Win check
        if (newHand.length === 0) {
          let hs = prev.hostScore
          let gsScore = prev.guestScore
          if (pIdx === 0) hs++
          else gsScore++
          
          const target = Math.ceil(prev.bestOf / 2)
          const matchOver = hs >= target || gsScore >= target

          playSound(pIdx === 0 ? 'win' : 'lose')
          if (pIdx === 0) confetti({ particleCount: 100, spread: 70 })

          const nextGs: GS = {
            ...prev,
            players: newPlayers, deck: newDeck, discard: newDiscard,
            phase: matchOver ? 'match_end' : 'round_end',
            hostScore: hs, guestScore: gsScore,
            roundWinner: pIdx === 0 ? 'host' : 'guest',
            matchWinner: matchOver ? (hs > gsScore ? 'host' : 'guest') : null
          }
          onBroadcastState(nextGs)
          return nextGs
        }

        if (card.color !== 'wild') newActiveColor = card.color

        if (card.value === 'reverse') {
          nextDir = (nextDir * -1) as Direction
          nextIdx = (prev.turnIdx + nextDir + 2) % 2 // in 2 player, reverse is skip
        } else if (card.value === 'skip') {
          nextIdx = (nextIdx + nextDir + 2) % 2
        } else if (card.value === 'draw2') {
          nextPendingDraw += 2
        } else if (card.color === 'wild') {
          pendingColorPicker = pIdx
          if (card.value === 'wild4') nextPendingDraw += 4
          nextIdx = prev.turnIdx // don't advance turn until color picked
        }

        if (nextPendingDraw > 0 && pendingColorPicker === null) {
          const { drawn, newDeck: d2, newDiscard: dis2 } = drawCards(newDeck, newDiscard, nextPendingDraw)
          newDeck = d2; newDiscard = dis2;
          newPlayers[nextIdx] = { ...newPlayers[nextIdx], hand: [...newPlayers[nextIdx].hand, ...drawn] }
          nextPendingDraw = 0
          nextIdx = (nextIdx + nextDir + 2) % 2
        }

        const nextGs = { ...prev, deck: newDeck, discard: newDiscard, players: newPlayers, activeColor: newActiveColor, turnIdx: nextIdx, direction: nextDir, pendingDraw: nextPendingDraw, pendingColorPicker, hasDrawnThisTurn: false, drawnCardId: null }
        onBroadcastState(nextGs)
        return nextGs
      }

      if (move.type === 'uno') {
        const nextGs = { ...prev, unoCalled: [...prev.unoCalled, move.playerId] }
        onBroadcastState(nextGs)
        playSound('match')
        return nextGs
      }

      return prev
    })
  }, [onBroadcastState, playSound])

  useEffect(() => {
    if (!isHost || !guestMove) return
    applyMove(guestMove, 1)
  }, [guestMove, isHost, applyMove])

  const doAction = (move: any) => {
    if (isHost) applyMove(move, 0)
    else onBroadcastMove(move)
  }

  const handleStartMatch = (bestOf: number) => {
    if (!isHost) return
    startRound(bestOf, 0, 0)
  }

  const handleNextRound = () => {
    if (!isHost) return
    startRound(gs.bestOf, gs.hostScore, gs.guestScore)
  }

  const startRound = (bestOf: number, hScore: number, gScore: number) => {
    const deck = shuffle(buildDeck())
    const hostHand = deck.splice(0, 7)
    const guestHand = deck.splice(0, 7)
    let topIdx = deck.findIndex(c => c.color !== 'wild')
    if (topIdx < 0) topIdx = 0
    const [topCard] = deck.splice(topIdx, 1)

    const nextGs: GS = {
      ...INIT_GS,
      phase: 'playing',
      bestOf,
      hostScore: hScore,
      guestScore: gScore,
      deck,
      discard: [topCard],
      players: [
        { id: 'host', name: 'Host', isHost: true, hand: hostHand },
        { id: 'guest', name: opponent?.name || 'Guest', isHost: false, hand: guestHand }
      ],
      turnIdx: 0,
      activeColor: topCard.color as CardColor,
    }
    setGs(nextGs)
    onBroadcastState(nextGs)
  }

  if (roomStatus === 'waiting') {
    return (
      <div className="glass-card mt-4 p-6 text-center">
        <p className="text-3xl">🃏</p>
        <p className="mt-2 font-black text-purple-800">Aguardando {opponent?.name ?? 'amigo'} entrar.</p>
      </div>
    )
  }

  if (gs.phase === 'config') {
    return (
      <div className="glass-card mt-4 p-6 text-center">
        <h2 className="text-xl font-bold text-purple-800 mb-4">Escolha a Duração</h2>
        {isHost ? (
          <div className="flex flex-col gap-3">
            {[1, 3, 5].map(bo => (
              <button key={bo} className="btn-primary py-2" onClick={() => handleStartMatch(bo)}>
                Melhor de {bo} (Ganha quem fizer {Math.ceil(bo/2)})
              </button>
            ))}
          </div>
        ) : (
          <p className="font-bold text-gray-600">Aguardando {opponent?.name} escolher a partida...</p>
        )}
      </div>
    )
  }

  const myIdx = isHost ? 0 : 1
  const oppIdx = isHost ? 1 : 0
  const myPlayer = gs.players[myIdx]
  const oppPlayer = gs.players[oppIdx]
  const isMyTurn = gs.turnIdx === myIdx && gs.phase === 'playing'
  const topCard = gs.discard[gs.discard.length - 1]

  const myScore = isHost ? gs.hostScore : gs.guestScore
  const oppScore = isHost ? gs.guestScore : gs.hostScore

  return (
    <div className="mt-4 flex flex-col items-center w-full max-w-[400px]">
      <div className="glass-card flex w-full items-center justify-between p-3 px-6 mb-4">
        <div className="text-center">
          <p className="text-xs font-black uppercase text-blue-600">Você</p>
          <p className="text-2xl font-black text-blue-600">{myScore}</p>
        </div>
        <div className="text-center flex-1 mx-4">
          <p className="text-xs font-black text-gray-400">MELHOR DE {gs.bestOf}</p>
          <p className="text-sm font-bold mt-1" style={{ color: isMyTurn ? '#166534' : '#6B7280' }}>
            {gs.phase === 'playing' ? (isMyTurn ? 'Sua vez!' : `Vez de ${opponent?.name}`) : 'Rodada Encerrada'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-black uppercase text-purple-600 truncate max-w-[80px]">{opponent?.name ?? 'Oponente'}</p>
          <p className="text-2xl font-black text-purple-600">{oppScore}</p>
        </div>
      </div>

      {gs.phase === 'playing' && (
        <div className="w-full flex flex-col">
          <div className="glass-card p-3 mb-4 flex flex-col items-center">
            <p className="text-sm font-bold mb-2 text-gray-600">Mão de {opponent?.name} ({oppPlayer?.hand.length})</p>
            <div className="flex gap-1 justify-center flex-wrap">
              {oppPlayer?.hand.slice(0, 10).map((_, i) => <CardBack key={i} small />)}
              {oppPlayer && oppPlayer.hand.length > 10 && <span className="text-xs font-bold text-gray-500 self-center">+{oppPlayer.hand.length - 10}</span>}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-xs mb-1 font-bold text-gray-500">Comprar ({gs.deck.length})</p>
              <motion.div
                onClick={isMyTurn && !gs.hasDrawnThisTurn && gs.pendingColorPicker === null ? () => doAction({ type: 'draw' }) : undefined}
                whileTap={isMyTurn && !gs.hasDrawnThisTurn ? { scale: 0.9 } : {}}
                style={{ cursor: isMyTurn && !gs.hasDrawnThisTurn && gs.pendingColorPicker === null ? 'pointer' : 'default', opacity: gs.hasDrawnThisTurn || gs.pendingColorPicker !== null ? 0.5 : 1 }}>
                <CardBack />
              </motion.div>
            </div>
            <div className="text-center relative">
              <p className="text-xs mb-1 font-bold text-gray-500">Descarte</p>
              {topCard && (
                <motion.div key={topCard.id} initial={{ scale: 0.7, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}>
                  <UnoCard card={{ ...topCard, color: gs.activeColor }} />
                </motion.div>
              )}
            </div>
          </div>

          {gs.pendingColorPicker === myIdx && (
            <div className="glass-card p-3 mb-4 flex justify-center gap-3">
              {COLORS.map(c => (
                <button key={c} onClick={() => doAction({ type: 'color', color: c })}
                  className="w-10 h-10 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform"
                  style={{ backgroundColor: COLOR_BG[c], border: `2px solid ${COLOR_BORDER[c]}` }} />
              ))}
            </div>
          )}

          {myPlayer && (
            <div className="glass-card p-3 relative">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm" style={{ color: isMyTurn ? '#7B5EA7' : '#9CA3AF' }}>Suas Cartas ({myPlayer.hand.length})</span>
                {isMyTurn && gs.hasDrawnThisTurn && gs.pendingColorPicker === null && (
                  <button onClick={() => doAction({ type: 'pass' })} className="btn-secondary text-xs px-3 py-1">Passar</button>
                )}
                {isMyTurn && myPlayer.hand.length === 2 && !gs.unoCalled.includes(myPlayer.id) && (
                  <button onClick={() => doAction({ type: 'uno', playerId: myPlayer.id })} className="btn-primary text-xs px-3 py-1 bg-red-500 border-red-700">UNO!</button>
                )}
              </div>
              <div className="flex gap-1 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                {myPlayer.hand.map(card => {
                  const isJustDrawn = gs.hasDrawnThisTurn && gs.drawnCardId === card.id
                  const playable = isMyTurn && gs.pendingColorPicker === null && isPlayable(card, topCard, gs.activeColor) && (!gs.hasDrawnThisTurn || isJustDrawn)
                  return (
                    <motion.div key={card.id} layout initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <UnoCard
                        card={card}
                        onClick={playable ? () => doAction({ type: 'play', cardId: card.id }) : undefined}
                        playable={playable}
                        style={isJustDrawn ? { outline: '2px solid #FCD34D', borderRadius: 10 } : {}}
                      />
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {gs.phase === 'round_end' && (
        <div className="glass-card mt-6 p-4 text-center w-full">
          <h3 className="text-xl font-bold mb-3 text-purple-800">
            {gs.roundWinner === 'draw' ? 'Empatou!' : gs.roundWinner === (isHost ? 'host' : 'guest') ? 'Você ganhou a rodada!' : `${opponent?.name} ganhou a rodada!`}
          </h3>
          {isHost ? (
            <button className="btn-primary w-full py-2" onClick={handleNextRound}>Próxima Rodada</button>
          ) : (
            <p className="text-sm text-gray-500">Aguardando anfitrião iniciar...</p>
          )}
        </div>
      )}

      {gs.phase === 'match_end' && (
        <div className="glass-card mt-6 p-4 text-center w-full">
          <h3 className="text-2xl font-bold mb-2 text-yellow-600">Fim de Jogo!</h3>
          <p className="text-lg font-bold mb-4 text-purple-800">
            {gs.matchWinner === 'draw' ? 'Empate Técnico!' : (isHost && gs.matchWinner === 'host') || (!isHost && gs.matchWinner === 'guest') ? '🏆 Você Venceu a Série!' : `💀 ${opponent?.name} Venceu a Série!`}
          </p>
          {isHost ? (
            <div className="flex gap-2">
              <button className="btn-primary flex-1 py-2" onClick={() => handleStartMatch(gs.bestOf)}>Revanche</button>
              <button className="btn-secondary flex-1 py-2" onClick={() => onFinish(gs.matchWinner!)}>Sair</button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aguardando anfitrião...</p>
          )}
        </div>
      )}
    </div>
  )
}
