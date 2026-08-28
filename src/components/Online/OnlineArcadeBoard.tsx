import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OnlineGameKey, OnlinePlayer } from '../../online/types'

type PlayerSide = 'host' | 'guest'
type ArcadeState = {
  result: 'playing' | 'finished'
  round: number
  scores: { host: number; guest: number }
  colors: string[]
  puzzle: number[]
  sequence: number[]
  sequenceIndex: number
  guessed: string[]
  word: string
  strikes: number
  paddles: { host: number; guest: number }
  winner?: PlayerSide | 'draw' | null
}

type Props = {
  game: OnlineGameKey
  isHost: boolean
  roomStatus: string
  opponent: OnlinePlayer | null
  broadcastGameState: unknown
  guestMove: unknown
  onBroadcastState: (state: unknown) => void
  onBroadcastMove: (move: unknown) => void
  onValidateAction: (move: unknown) => Promise<boolean>
  onFinish: (winner: string | null) => Promise<void>
}

const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308']
const WORDS = ['AMOR', 'PAZ', 'LUZ', 'GRACA', 'FE']
const TITLES: Record<string, string> = {
  coloring: 'Colorindo juntos', snake: 'Cobrinha em equipe', simon: 'Sequência de Cores',
  puzzle: 'Quebra-Cabeça compartilhado', pong: 'Ping Pong', hangman: 'Forca Bíblica',
}

function initialState(game: OnlineGameKey): ArcadeState {
  return {
    result: 'playing', round: 1, scores: { host: 0, guest: 0 }, colors: Array(12).fill(''),
    puzzle: [1, 2, 3, 4, 5, 6, 0, 7, 8],
    sequence: game === 'simon' ? [Math.floor(Math.random() * 4)] : [], sequenceIndex: 0,
    guessed: [], word: WORDS[Math.floor(Math.random() * WORDS.length)], strikes: 0,
    paddles: { host: 50, guest: 50 }, winner: null,
  }
}

function sideOf(isHost: boolean): PlayerSide { return isHost ? 'host' : 'guest' }

export default function OnlineArcadeBoard({ game, isHost, roomStatus, opponent, broadcastGameState, guestMove, onBroadcastState, onBroadcastMove, onValidateAction, onFinish }: Props) {
  const side = sideOf(isHost)
  const [state, setState] = useState<ArcadeState>(() => initialState(game))
  const initialized = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const publish = useCallback((next: ArcadeState) => {
    setState(next)
    if (isHost) onBroadcastState(next)
  }, [isHost, onBroadcastState])

  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initialized.current) return
    initialized.current = true
    const next = initialState(game)
    setState(next)
    onBroadcastState(next)
  }, [game, isHost, onBroadcastState, roomStatus])

  useEffect(() => {
    if (!isHost && broadcastGameState) setState(broadcastGameState as ArcadeState)
  }, [broadcastGameState, isHost])

  const applyAction = useCallback((action: any, actor: PlayerSide) => {
    const current = stateRef.current
    if (current.result === 'finished') return
    const next: ArcadeState = {
      ...current, scores: { ...current.scores }, colors: [...current.colors], puzzle: [...current.puzzle],
      sequence: [...current.sequence], guessed: [...current.guessed], paddles: { ...current.paddles },
    }
    if (game === 'coloring' && action.type === 'color' && Number.isInteger(action.index) && action.index >= 0 && action.index < next.colors.length && COLORS.includes(action.color)) {
      next.colors[action.index] = action.color
    } else if (game === 'snake' && action.type === 'collect') {
      next.scores[actor] = Math.min(10, next.scores[actor] + 1)
    } else if (game === 'simon' && action.type === 'simon') {
      if (action.value !== next.sequence[next.sequenceIndex]) { next.strikes += 1; next.sequenceIndex = 0 }
      else if (next.sequenceIndex + 1 >= next.sequence.length) { next.scores[actor] += 1; next.round += 1; next.sequence = [...next.sequence, Math.floor(Math.random() * 4)]; next.sequenceIndex = 0 }
      else next.sequenceIndex += 1
    } else if (game === 'puzzle' && action.type === 'tile' && Number.isInteger(action.index)) {
      const index = action.index; const empty = next.puzzle.indexOf(0); const distance = Math.abs(index - empty)
      if (index >= 0 && index < 9 && [1, 3].includes(distance) && !(distance === 1 && Math.floor(index / 3) !== Math.floor(empty / 3))) [next.puzzle[index], next.puzzle[empty]] = [next.puzzle[empty], next.puzzle[index]]
    } else if (game === 'pong' && action.type === 'paddle' && (action.direction === -1 || action.direction === 1)) {
      next.paddles[actor] = Math.max(10, Math.min(90, next.paddles[actor] + action.direction * 10))
    } else if (game === 'hangman' && action.type === 'guess' && /^[A-Z]$/.test(action.letter) && !next.guessed.includes(action.letter)) {
      next.guessed.push(action.letter)
      if (!next.word.includes(action.letter)) next.strikes += 1
    } else return

    if (game === 'coloring' && next.colors.every(Boolean)) next.winner = 'draw'
    if (game === 'snake' && next.scores[actor] >= 10) next.winner = actor
    if (game === 'simon' && next.strikes >= 3) next.winner = actor === 'host' ? 'guest' : 'host'
    if (game === 'puzzle' && next.puzzle.join(',') === '1,2,3,4,5,6,7,8,0') next.winner = actor
    if (game === 'pong' && next.paddles[actor] <= 10) next.winner = actor === 'host' ? 'guest' : 'host'
    if (game === 'hangman' && next.word.split('').every(letter => next.guessed.includes(letter))) next.winner = actor
    if (next.winner) next.result = 'finished'
    publish(next)
    if (next.result === 'finished') void onFinish(next.winner || null)
  }, [game, onFinish, publish])

  useEffect(() => {
    if (isHost && guestMove) applyAction(guestMove, 'guest')
  }, [applyAction, guestMove, isHost])

  const action = (value: any) => {
    if (isHost) void onValidateAction(value).then(valid => { if (valid) applyAction(value, 'host') })
    else onBroadcastMove(value)
  }
  const revealedWord = useMemo(() => state.word.split('').map(letter => state.guessed.includes(letter) ? letter : '_').join(' '), [state.guessed, state.word])
  const winnerText = state.winner === 'draw' ? 'Muito bem, equipe!' : state.winner === side ? 'Você venceu!' : `${opponent?.name || 'Seu amigo'} venceu!`

  if (roomStatus === 'waiting') return <div className="glass-card mt-4 p-6 text-center"><p className="text-3xl">⏳</p><p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Aguardando {opponent?.name ?? 'amigo'} aceitar…</p></div>
  if (roomStatus === 'cancelled') return <div className="glass-card mt-4 p-6 text-center"><p className="font-black" style={{ color: '#5B3A8A' }}>Sala encerrada.</p></div>

  return <section className="glass-card mt-4 p-4" aria-labelledby="arcade-title">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 id="arcade-title" className="font-title text-2xl" style={{ color: '#5B3A8A' }}>{TITLES[game]}</h2><p className="text-xs" style={{ color: '#4B5563' }}>Modo online compartilhado com {opponent?.name || 'seu amigo'}.</p></div><p className="text-sm font-black" style={{ color: '#2563A6' }}>Você {state.scores[side]} × {state.scores[side === 'host' ? 'guest' : 'host']} {opponent?.name || 'amigo'}</p></div>
    {game === 'coloring' && <><p className="mt-3 text-sm font-bold">Escolham uma cor e pintem todas as regiões juntos.</p><div className="mt-3 grid grid-cols-4 gap-2">{state.colors.map((color, index) => <button key={index} type="button" aria-label={`Região ${index + 1}${color ? ', colorida' : ''}`} className="aspect-square rounded-xl border-2 border-purple-200" style={{ background: color || '#F3F4F6' }} onClick={() => action({ type: 'color', index, color: COLORS[index % COLORS.length] })} />)}</div></>}
    {game === 'snake' && <><p className="mt-3 text-sm font-bold">Coletem 10 estrelas para vencer.</p><button type="button" className="btn-primary mt-4 w-full" onClick={() => action({ type: 'collect' })}>⭐ Coletar estrela ({state.scores[side]}/10)</button></>}
    {game === 'simon' && <><p className="mt-3 text-sm font-bold">Repita a sequência. Três erros encerram a rodada.</p><div className="mt-3 grid grid-cols-2 gap-2">{COLORS.map((color, index) => <button key={color} type="button" aria-label={`Cor ${index + 1}`} className="min-h-16 rounded-2xl" style={{ background: color }} onClick={() => action({ type: 'simon', value: index })} />)}</div><p className="mt-3 text-center text-xs font-bold">Sequência: {state.sequence.map(index => index + 1).join(' • ')}</p></>}
    {game === 'puzzle' && <><p className="mt-3 text-sm font-bold">Movam as peças juntos até formar 1 a 8.</p><div className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-2">{state.puzzle.map((tile, index) => <button key={index} type="button" aria-label={tile ? `Peça ${tile}` : 'Espaço vazio'} className="aspect-square rounded-xl bg-blue-100 text-xl font-black text-blue-900" onClick={() => action({ type: 'tile', index })}>{tile || ''}</button>)}</div></>}
    {game === 'pong' && <><p className="mt-3 text-sm font-bold">Mantenham a raquete na linha usando os botões.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className="btn-secondary" onClick={() => action({ type: 'paddle', direction: -1 })}>↑ Subir</button><button type="button" className="btn-secondary" onClick={() => action({ type: 'paddle', direction: 1 })}>↓ Descer</button></div><div className="mt-3 h-24 rounded-2xl bg-slate-900 p-3"><div className="h-2 rounded bg-yellow-300" style={{ marginTop: `${state.paddles[side]}%` }} /></div></>}
    {game === 'hangman' && <><p className="mt-3 text-sm font-bold">Descubram a palavra bíblica antes de 3 erros.</p><p className="mt-4 text-center text-3xl font-black tracking-[.35em] text-purple-800">{revealedWord}</p><div className="mt-4 grid grid-cols-7 gap-1">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => <button key={letter} type="button" disabled={state.guessed.includes(letter)} className="min-h-10 rounded-lg bg-purple-50 text-sm font-black text-purple-800 disabled:opacity-40" onClick={() => action({ type: 'guess', letter })}>{letter}</button>)}</div><p className="mt-3 text-center text-sm font-bold">Erros: {state.strikes}/3</p></>}
    {state.result === 'finished' && <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-center"><p className="font-title text-xl text-yellow-800">{winnerText}</p><p className="mt-1 text-sm font-bold">A partida foi encerrada.</p></div>}
  </section>
}
