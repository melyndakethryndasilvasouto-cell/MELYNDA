import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OnlinePlayer } from '../../online/types'
import { cleanStopAnswers, scoreStopRound, STOP_CATEGORIES, STOP_LETTERS } from '../../online/newGameRules.mjs'

type Side = 'host' | 'guest'
type Answers = Record<string, string>
type ScoreRow = { key: string; label: string; hostAnswer: string; guestAnswer: string; hostScore: number; guestScore: number }
type State = { letter: string; hostReady: boolean; guestReady: boolean; phase: 'filling' | 'finished'; hostAnswers: Answers | null; guestAnswers: Answers | null; rows: ScoreRow[]; hostScore: number; guestScore: number; winner: Side | 'draw' | null }
type Props = { isHost: boolean; roomStatus: string; opponent: OnlinePlayer | null; broadcastGameState: unknown; guestMove: unknown; stateRequest: number; onBroadcastState: (state: unknown) => void; onBroadcastMove: (move: unknown) => Promise<boolean>; onValidateAction: (move: unknown) => Promise<boolean>; onFinish: (winner: Side | 'draw') => Promise<void> }

const emptyAnswers = () => Object.fromEntries(STOP_CATEGORIES.map(({ key }) => [key, '']))
const createState = (): State => ({ letter: STOP_LETTERS[Math.floor(Math.random() * STOP_LETTERS.length)], hostReady: false, guestReady: false, phase: 'filling', hostAnswers: null, guestAnswers: null, rows: [], hostScore: 0, guestScore: 0, winner: null })
const publicState = (state: State): State => state.phase === 'filling' ? { ...state, hostAnswers: null, guestAnswers: null } : state

export default function OnlineAdedonhaBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, stateRequest, onBroadcastState, onBroadcastMove, onValidateAction, onFinish }: Props) {
  const [gameState, setGameState] = useState<State>(() => createState())
  const [answers, setAnswers] = useState<Answers>(() => emptyAnswers())
  const [submitting, setSubmitting] = useState(false)
  const initialized = useRef(false)
  const stateRef = useRef(gameState)
  stateRef.current = gameState

  const publish = useCallback((next: State) => { stateRef.current = next; setGameState(next); onBroadcastState(publicState(next)) }, [onBroadcastState])
  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initialized.current) return
    initialized.current = true
    const next = createState()
    setGameState(next); setAnswers(emptyAnswers()); onBroadcastState(publicState(next))
  }, [isHost, onBroadcastState, roomStatus])
  useEffect(() => { if (!isHost && broadcastGameState) setGameState(broadcastGameState as State) }, [broadcastGameState, isHost])
  useEffect(() => { if (isHost && stateRequest > 0 && initialized.current) onBroadcastState(publicState(stateRef.current)) }, [isHost, onBroadcastState, stateRequest])

  const finishWithGuest = useCallback((guestAnswers: Answers) => {
    const current = stateRef.current
    if (!current.hostReady || !current.hostAnswers || current.guestReady || current.phase !== 'filling') return
    const scored = scoreStopRound(current.letter, current.hostAnswers, guestAnswers)
    const winner: Side | 'draw' = scored.hostScore > scored.guestScore ? 'host' : scored.guestScore > scored.hostScore ? 'guest' : 'draw'
    const next: State = { ...current, guestReady: true, guestAnswers: cleanStopAnswers(guestAnswers), phase: 'finished', rows: scored.rows, hostScore: scored.hostScore, guestScore: scored.guestScore, winner }
    publish(next)
    void onFinish(winner)
  }, [onFinish, publish])

  useEffect(() => {
    if (!isHost || !guestMove) return
    const move = guestMove as { type?: string; answers?: Answers }
    if (move.type === 'adedonha-submit' && move.answers) finishWithGuest(move.answers)
  }, [finishWithGuest, guestMove, isHost])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const cleaned = cleanStopAnswers(answers)
    const move = { type: 'adedonha-submit', answers: cleaned }
    setSubmitting(true)
    try {
      if (isHost) {
        if (gameState.hostReady || !await onValidateAction(move)) return
        publish({ ...stateRef.current, hostReady: true, hostAnswers: cleaned })
      } else if (gameState.hostReady && !gameState.guestReady) {
        if (await onBroadcastMove(move)) setGameState(previous => ({ ...previous, guestReady: true }))
      }
    } finally { setSubmitting(false) }
  }

  const myReady = isHost ? gameState.hostReady : gameState.guestReady
  const canFill = !submitting && gameState.phase === 'filling' && !myReady && (isHost || gameState.hostReady)
  const myScore = isHost ? gameState.hostScore : gameState.guestScore
  const theirScore = isHost ? gameState.guestScore : gameState.hostScore
  const resultRows = useMemo(() => gameState.rows.map(row => ({ ...row, mine: isHost ? row.hostAnswer : row.guestAnswer, theirs: isHost ? row.guestAnswer : row.hostAnswer, myPoints: isHost ? row.hostScore : row.guestScore, theirPoints: isHost ? row.guestScore : row.hostScore })), [gameState.rows, isHost])

  if (roomStatus === 'waiting') return <div className="glass-card mt-4 p-6 text-center"><p className="text-3xl">⏳</p><p className="mt-2 font-black">Aguardando {opponent?.name ?? 'amigo'} aceitar…</p></div>
  if (roomStatus === 'cancelled') return <div className="glass-card mt-4 p-6 text-center font-black">Sala encerrada.</div>
  if (gameState.phase === 'finished') return <section className="glass-card mt-4 p-4" aria-labelledby="adedonha-title"><h2 id="adedonha-title" className="text-center font-title text-2xl" style={{ color: '#5B3A8A' }}>📝 Resultado da Adedonha</h2><p className="mt-2 text-center text-lg font-black">{gameState.winner === 'draw' ? 'Empate!' : gameState.winner === (isHost ? 'host' : 'guest') ? 'Você venceu!' : `${opponent?.name ?? 'Seu amigo'} venceu!`} • {myScore} × {theirScore}</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm"><thead><tr className="border-b-2 border-purple-200"><th className="p-2">Categoria</th><th className="p-2">Você</th><th className="p-2">Pontos</th><th className="p-2">Amigo</th><th className="p-2">Pontos</th></tr></thead><tbody>{resultRows.map(row => <tr key={row.key} className="border-b border-slate-100"><th className="p-2">{row.label}</th><td className="p-2">{row.mine || '—'}</td><td className="p-2 font-black">{row.myPoints}</td><td className="p-2">{row.theirs || '—'}</td><td className="p-2 font-black">{row.theirPoints}</td></tr>)}</tbody></table></div><p className="mt-3 text-center text-xs font-bold">10 pontos para resposta válida e diferente; 5 quando os dois escrevem a mesma resposta.</p></section>

  return <section className="glass-card mt-4 p-4" aria-labelledby="adedonha-title">
    <div className="text-center"><h2 id="adedonha-title" className="font-title text-2xl" style={{ color: '#5B3A8A' }}>📝 Adedonha</h2><p className="mt-2 text-sm font-bold">Todas as respostas começam com</p><p className="mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-300 font-title text-5xl text-purple-900" aria-label={`Letra ${gameState.letter}`}>{gameState.letter}</p></div>
    {!isHost && !gameState.hostReady ? <p className="mt-5 rounded-2xl bg-blue-50 p-4 text-center font-bold" role="status">Aguarde o anfitrião terminar. As respostas dele ficarão escondidas.</p> : myReady ? <p className="mt-5 rounded-2xl bg-green-50 p-4 text-center font-bold text-green-800" role="status">Respostas enviadas! Aguardando {opponent?.name ?? 'seu amigo'}…</p> : <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={event => void submit(event)}>{STOP_CATEGORIES.map(category => <label key={category.key} className="text-sm font-black" style={{ color: '#374151' }}>{category.label}<input value={answers[category.key]} disabled={!canFill} maxLength={24} pattern="[A-Za-zÀ-ÿ '-]{2,24}" title={`Escreva uma resposta com a letra ${gameState.letter}`} onChange={event => setAnswers(previous => ({ ...previous, [category.key]: event.target.value }))} className="mt-1 min-h-12 w-full rounded-xl border-2 border-purple-100 bg-white px-3 font-bold uppercase focus:border-blue-600 focus:outline-none" /><span className="mt-1 block text-[11px] font-normal" style={{ color: '#6B7280' }}>{category.hint}</span></label>)}<button type="submit" className="btn-primary mt-1 sm:col-span-2" disabled={!canFill}>ADEDONHA! Enviar respostas</button></form>}
    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-center text-xs font-bold" style={{ color: '#854D0E' }}>Proteja sua privacidade: não escreva seu nome completo, sua escola, seu endereço nem o lugar onde mora.</p>
  </section>
}
