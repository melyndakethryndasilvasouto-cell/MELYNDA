import { useCallback, useEffect, useRef, useState } from 'react'
import type { OnlinePlayer } from '../../online/types'
import memoryPairs from '../../data/memoryPairs.json'

interface OnlineMemoryBoardProps {
  isHost: boolean
  roomStatus: string
  opponent: OnlinePlayer | null
  broadcastGameState: unknown
  guestMove: unknown
  onBroadcastState: (state: unknown) => void
  onBroadcastMove: (move: unknown) => void
  onFinish: (winner: 'host' | 'guest' | 'draw') => Promise<void>
}

interface CardState {
  id: string
  pairId: string
  emoji: string
  title: string
  isFlipped: boolean
  isMatched: boolean
}

interface GameState {
  cards: CardState[]
  hostScore: number
  guestScore: number
  turn: 'host' | 'guest'
  flipped: string[]
  phase: 'playing' | 'checking' | 'finished'
  winner: 'host' | 'guest' | 'draw' | null
}

function buildDeck(): CardState[] {
  const pairs = memoryPairs.slice(0, 6)
  const cards: CardState[] = []
  for (const pair of pairs) {
    for (let i = 0; i < 2; i++) {
      cards.push({ id: `${pair.id}-${i}`, pairId: String(pair.id), emoji: pair.emoji, title: pair.title, isFlipped: false, isMatched: false })
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

const INIT: GameState = { cards: [], hostScore: 0, guestScore: 0, turn: 'host', flipped: [], phase: 'playing', winner: null }

export default function OnlineMemoryBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, onBroadcastState, onBroadcastMove, onFinish }: OnlineMemoryBoardProps) {
  const [gs, setGs] = useState<GameState>(INIT)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initRef.current) return
    initRef.current = true
    const s: GameState = { ...INIT, cards: buildDeck() }
    setGs(s)
    onBroadcastState(s)
  }, [isHost, roomStatus, onBroadcastState])

  useEffect(() => {
    if (isHost || !broadcastGameState) return
    setGs(broadcastGameState as GameState)
  }, [isHost, broadcastGameState])

  const flipCard = useCallback((cardId: string) => {
    setGs(prev => {
      if (prev.phase !== 'playing' || prev.flipped.length >= 2 || prev.flipped.includes(cardId)) return prev
      const card = prev.cards.find(c => c.id === cardId)
      if (!card || card.isMatched || card.isFlipped) return prev
      const cards = prev.cards.map(c => c.id === cardId ? { ...c, isFlipped: true } : c)
      const flipped = [...prev.flipped, cardId]
      let next: GameState
      if (flipped.length === 2) {
        const [a, b] = flipped.map(id => cards.find(c => c.id === id)!)
        if (a.pairId === b.pairId) {
          const matched = cards.map(c => c.pairId === a.pairId ? { ...c, isMatched: true } : c)
          const hs = prev.turn === 'host' ? prev.hostScore + 1 : prev.hostScore
          const gs2 = prev.turn === 'guest' ? prev.guestScore + 1 : prev.guestScore
          const done = matched.every(c => c.isMatched)
          next = { ...prev, cards: matched, hostScore: hs, guestScore: gs2, flipped: [], phase: done ? 'finished' : 'playing', winner: done ? (hs > gs2 ? 'host' : gs2 > hs ? 'guest' : 'draw') : null }
        } else {
          next = { ...prev, cards, flipped, phase: 'checking' }
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            setGs(s => {
              const r: GameState = { ...s, cards: s.cards.map(c => s.flipped.includes(c.id) ? { ...c, isFlipped: false } : c), flipped: [], turn: s.turn === 'host' ? 'guest' : 'host', phase: 'playing' }
              onBroadcastState(r)
              return r
            })
          }, 1200)
        }
      } else {
        next = { ...prev, cards, flipped }
      }
      onBroadcastState(next)
      return next
    })
  }, [onBroadcastState])

  useEffect(() => {
    if (!isHost || !guestMove) return
    const m = guestMove as { cardId?: string }
    if (m.cardId) flipCard(m.cardId)
  }, [guestMove, isHost, flipCard])

  useEffect(() => {
    if (gs.phase === 'finished' && gs.winner) void onFinish(gs.winner)
  }, [gs.phase, gs.winner, onFinish])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const myRole = isHost ? 'host' : 'guest'
  const myTurn = gs.turn === myRole
  const myScore = isHost ? gs.hostScore : gs.guestScore
  const oppScore = isHost ? gs.guestScore : gs.hostScore

  if (roomStatus === 'waiting') return <div className="glass-card mt-4 p-6 text-center"><p className="text-3xl">⏳</p><p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Aguardando {opponent?.name ?? 'amigo'} aceitar…</p></div>
  if (roomStatus === 'cancelled') return <div className="glass-card mt-4 p-6 text-center"><p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Sala encerrada.</p></div>
  if (gs.cards.length === 0) return <div className="glass-card mt-4 p-6 text-center"><p className="animate-pulse font-black" style={{ color: '#5B3A8A' }}>Preparando cartas…</p></div>

  return (
    <div className="mt-4">
      <div className="glass-card mb-3 flex items-center justify-between px-4 py-2">
        <div className="text-center"><p className="text-xs font-black uppercase" style={{ color: '#4A90D9' }}>Você</p><p className="text-2xl font-black" style={{ color: '#4A90D9' }}>{myScore}</p></div>
        <p className={`text-sm font-black ${myTurn ? 'text-green-700' : 'text-gray-500'}`}>
          {gs.phase === 'finished' ? (gs.winner === myRole ? '🎉 Você venceu!' : gs.winner === 'draw' ? '🤝 Empate!' : `${opponent?.name ?? 'Amigo'} venceu!`) : myTurn ? 'Sua vez!' : `Vez de ${opponent?.name ?? 'amigo'}…`}
        </p>
        <div className="text-center"><p className="text-xs font-black uppercase" style={{ color: '#7B5EA7' }}>{opponent?.name ?? 'Amigo'}</p><p className="text-2xl font-black" style={{ color: '#7B5EA7' }}>{oppScore}</p></div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {gs.cards.map(card => (
          <button key={card.id} type="button"
            disabled={card.isMatched || card.isFlipped || !myTurn || gs.phase !== 'playing'}
            onClick={() => { if (isHost) { flipCard(card.id) } else { onBroadcastMove({ cardId: card.id }) } }}
            className="aspect-square rounded-2xl text-2xl transition-all active:scale-95 disabled:cursor-default"
            style={{ background: card.isMatched ? '#DCFCE7' : card.isFlipped ? '#EDE9FE' : 'linear-gradient(135deg,#4A90D9,#7B5EA7)', border: card.isMatched ? '2px solid #86EFAC' : card.isFlipped ? '2px solid #A78BFA' : 'none' }}
            aria-label={card.isFlipped || card.isMatched ? card.title : 'Carta'}
          >{card.isFlipped || card.isMatched ? card.emoji : '✝️'}</button>
        ))}
      </div>
    </div>
  )
}
