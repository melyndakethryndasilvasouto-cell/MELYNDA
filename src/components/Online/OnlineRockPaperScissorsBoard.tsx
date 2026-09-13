import { useCallback, useEffect, useRef, useState } from 'react'
import type { OnlinePlayer } from '../../online/types'
import { RPS_CHOICES, rpsRoundWinner } from '../../online/newGameRules.mjs'

type Side = 'host' | 'guest'
type Choice = 'rock' | 'paper' | 'scissors'
type State = {
  round: number
  hostScore: number
  guestScore: number
  hostReady: boolean
  guestReady: boolean
  hostChoice: Choice | null
  guestChoice: Choice | null
  phase: 'choosing' | 'reveal' | 'finished'
  winner: Side | 'draw' | null
}
type Props = {
  isHost: boolean; roomStatus: string; opponent: OnlinePlayer | null; broadcastGameState: unknown; guestMove: unknown; stateRequest: number
  onBroadcastState: (state: unknown) => void; onBroadcastMove: (move: unknown) => Promise<boolean>; onValidateAction: (move: unknown) => Promise<boolean>
  onFinish: (winner: Side | 'draw') => Promise<void>
}

const INITIAL: State = { round: 1, hostScore: 0, guestScore: 0, hostReady: false, guestReady: false, hostChoice: null, guestChoice: null, phase: 'choosing', winner: null }
const CHOICES: { key: Choice; emoji: string; label: string }[] = [
  { key: 'rock', emoji: '✊', label: 'Pedra' }, { key: 'paper', emoji: '✋', label: 'Papel' }, { key: 'scissors', emoji: '✌️', label: 'Tesoura' },
]

function publicState(state: State): State {
  return state.phase === 'choosing' ? { ...state, hostChoice: null, guestChoice: null } : state
}

export default function OnlineRockPaperScissorsBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, stateRequest, onBroadcastState, onBroadcastMove, onValidateAction, onFinish }: Props) {
  const [gameState, setGameState] = useState<State>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const stateRef = useRef(gameState)
  const initialized = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  stateRef.current = gameState

  const publish = useCallback((next: State) => {
    stateRef.current = next
    setGameState(next)
    onBroadcastState(publicState(next))
  }, [onBroadcastState])

  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initialized.current) return
    initialized.current = true
    setGameState(INITIAL)
    onBroadcastState(publicState(INITIAL))
  }, [isHost, onBroadcastState, roomStatus])
  useEffect(() => { if (!isHost && broadcastGameState) setGameState(broadcastGameState as State) }, [broadcastGameState, isHost])
  useEffect(() => { if (isHost && stateRequest > 0 && initialized.current) onBroadcastState(publicState(stateRef.current)) }, [isHost, onBroadcastState, stateRequest])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const resolveRound = useCallback((guestChoice: Choice) => {
    const current = stateRef.current
    if (current.phase !== 'choosing' || !current.hostChoice || current.guestReady) return
    const roundWinner = rpsRoundWinner(current.hostChoice, guestChoice)
    const hostScore = current.hostScore + (roundWinner === 'host' ? 1 : 0)
    const guestScore = current.guestScore + (roundWinner === 'guest' ? 1 : 0)
    const winner = hostScore >= 3 ? 'host' : guestScore >= 3 ? 'guest' : null
    const revealed: State = { ...current, hostScore, guestScore, guestReady: true, guestChoice, phase: winner ? 'finished' : 'reveal', winner }
    publish(revealed)
    if (winner) void onFinish(winner)
    else timer.current = setTimeout(() => publish({ ...revealed, round: revealed.round + 1, hostReady: false, guestReady: false, hostChoice: null, guestChoice: null, phase: 'choosing' }), 2200)
  }, [onFinish, publish])

  useEffect(() => {
    if (!isHost || !guestMove) return
    const move = guestMove as { type?: string; choice?: Choice }
    if (move.type === 'rps-choice' && RPS_CHOICES.includes(move.choice)) resolveRound(move.choice!)
  }, [guestMove, isHost, resolveRound])

  const choose = async (choice: Choice) => {
    if (gameState.phase !== 'choosing' || submitting) return
    const move = { type: 'rps-choice', choice }
    setSubmitting(true)
    try {
      if (isHost) {
        if (gameState.hostReady || !await onValidateAction(move)) return
        publish({ ...stateRef.current, hostReady: true, hostChoice: choice })
      } else if (gameState.hostReady && !gameState.guestReady) {
        if (await onBroadcastMove(move)) setGameState(previous => ({ ...previous, guestReady: true, guestChoice: choice }))
      }
    } finally { setSubmitting(false) }
  }

  if (roomStatus === 'waiting') return <div className="glass-card mt-4 p-6 text-center"><p className="text-3xl">⏳</p><p className="mt-2 font-black">Aguardando {opponent?.name ?? 'amigo'} aceitar…</p></div>
  if (roomStatus === 'cancelled') return <div className="glass-card mt-4 p-6 text-center font-black">Sala encerrada.</div>
  const side: Side = isHost ? 'host' : 'guest'
  const myScore = isHost ? gameState.hostScore : gameState.guestScore
  const theirScore = isHost ? gameState.guestScore : gameState.hostScore
  const canChoose = !submitting && gameState.phase === 'choosing' && (isHost ? !gameState.hostReady : gameState.hostReady && !gameState.guestReady)
  const message = gameState.phase === 'finished' ? (gameState.winner === side ? 'Você venceu a melhor de cinco!' : `${opponent?.name ?? 'Seu amigo'} venceu!`)
    : gameState.phase === 'reveal' ? 'Resultado da rodada' : canChoose ? 'Escolha agora' : isHost ? 'Aguardando seu amigo escolher…' : 'Aguardando o anfitrião escolher…'

  return <section className="glass-card mt-4 p-4 text-center" aria-labelledby="rps-title">
    <h2 id="rps-title" className="font-title text-2xl" style={{ color: '#5B3A8A' }}>✊ ✋ ✌️ Pedra, Papel e Tesoura</h2>
    <p className="mt-1 text-sm font-bold" role="status" aria-live="polite">Rodada {gameState.round} • {message}</p>
    <div className="mx-auto mt-3 flex max-w-sm items-center justify-around rounded-2xl bg-blue-50 p-3"><span><strong className="block text-2xl text-blue-700">{myScore}</strong>Você</span><span className="font-black">×</span><span><strong className="block text-2xl text-purple-700">{theirScore}</strong>{opponent?.name ?? 'Amigo'}</span></div>
    {gameState.phase === 'reveal' || gameState.phase === 'finished' ? <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-blue-50 p-4"><span className="text-5xl" aria-hidden="true">{CHOICES.find(item => item.key === (isHost ? gameState.hostChoice : gameState.guestChoice))?.emoji}</span><p className="mt-1 font-black">Sua escolha</p></div><div className="rounded-2xl bg-purple-50 p-4"><span className="text-5xl" aria-hidden="true">{CHOICES.find(item => item.key === (isHost ? gameState.guestChoice : gameState.hostChoice))?.emoji}</span><p className="mt-1 font-black">Escolha do amigo</p></div></div> : <div className="mt-4 grid grid-cols-3 gap-2">{CHOICES.map(item => <button key={item.key} type="button" disabled={!canChoose} onClick={() => void choose(item.key)} className="min-h-28 rounded-2xl bg-gradient-to-b from-yellow-50 to-orange-100 p-2 font-black shadow-sm disabled:opacity-45"><span className="block text-5xl" aria-hidden="true">{item.emoji}</span>{item.label}</button>)}</div>}
    <p className="mt-3 text-xs font-bold" style={{ color: '#4B5563' }}>O anfitrião escolhe primeiro, mas a escolha fica escondida. O primeiro a marcar 3 pontos vence.</p>
  </section>
}
