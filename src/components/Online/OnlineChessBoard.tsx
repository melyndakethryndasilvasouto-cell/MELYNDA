import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OnlinePlayer } from '../../online/types'
import { applyChessMove, createChessState, legalChessMoves, validChessState } from '../../online/chessRules.mjs'

type Props = {
  isHost: boolean
  roomStatus: string
  opponent: OnlinePlayer | null
  broadcastGameState: unknown
  guestMove: unknown
  stateRequest: number
  onBroadcastState: (state: unknown) => void
  onBroadcastMove: (move: unknown) => Promise<boolean>
  onValidateAction: (move: unknown) => Promise<boolean>
  onFinish: (winner: 'host' | 'guest' | 'draw') => Promise<void>
}

type Position = [number, number]
type ChessState = ReturnType<typeof createChessState>

const SYMBOLS: Record<string, string> = {
  whiteking: '♔', whitequeen: '♕', whiterook: '♖', whitebishop: '♗', whiteknight: '♘', whitepawn: '♙',
  blackking: '♚', blackqueen: '♛', blackrook: '♜', blackbishop: '♝', blackknight: '♞', blackpawn: '♟',
}
const PIECE_NAMES: Record<string, string> = { king: 'rei', queen: 'dama', rook: 'torre', bishop: 'bispo', knight: 'cavalo', pawn: 'peão' }

export default function OnlineChessBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, stateRequest, onBroadcastState, onBroadcastMove, onValidateAction, onFinish }: Props) {
  const [gameState, setGameState] = useState<ChessState>(() => createChessState())
  const [selected, setSelected] = useState<Position | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const initialized = useRef(false)
  const stateRef = useRef(gameState)
  stateRef.current = gameState

  const publish = useCallback((next: ChessState) => {
    stateRef.current = next
    setGameState(next)
    onBroadcastState(next)
    if (next.phase === 'finished' && next.winner) void onFinish(next.winner)
  }, [onBroadcastState, onFinish])

  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initialized.current) return
    initialized.current = true
    const next = createChessState()
    setGameState(next)
    onBroadcastState(next)
  }, [isHost, onBroadcastState, roomStatus])

  useEffect(() => {
    if (!isHost && validChessState(broadcastGameState)) setGameState(broadcastGameState as ChessState)
  }, [broadcastGameState, isHost])

  useEffect(() => {
    if (isHost && stateRequest > 0 && initialized.current) onBroadcastState(stateRef.current)
  }, [isHost, onBroadcastState, stateRequest])

  const applyMove = useCallback((from: Position, to: Position) => {
    const next = applyChessMove(stateRef.current, from, to)
    if (next !== stateRef.current) publish(next)
  }, [publish])

  useEffect(() => {
    if (!isHost || !guestMove || stateRef.current.turn !== 'black') return
    const move = guestMove as { type?: string; from?: Position; to?: Position }
    if (move.type === 'chess-move' && move.from && move.to) applyMove(move.from, move.to)
  }, [applyMove, guestMove, isHost])

  const myColor = isHost ? 'white' : 'black'
  const myTurn = gameState.turn === myColor && gameState.phase === 'playing' && !submitting
  const legalTargets = useMemo(() => selected ? legalChessMoves(gameState, selected) as Position[] : [], [gameState, selected])
  const viewSquares = useMemo(() => {
    const values: Position[] = []
    const rows = isHost ? [...Array(8).keys()] : [...Array(8).keys()].reverse()
    const cols = isHost ? [...Array(8).keys()] : [...Array(8).keys()].reverse()
    for (const row of rows) for (const col of cols) values.push([row, col])
    return values
  }, [isHost])

  const chooseSquare = async (row: number, col: number) => {
    if (!myTurn) return
    const target = gameState.board[row][col]
    if (selected && legalTargets.some(([r, c]) => r === row && c === col)) {
      const move = { type: 'chess-move', from: selected, to: [row, col] as Position }
      setSelected(null)
      setSubmitting(true)
      try {
        if (isHost) { if (await onValidateAction(move)) applyMove(move.from, move.to) }
        else await onBroadcastMove(move)
      } finally { setSubmitting(false) }
      return
    }
    setSelected(target?.color === myColor ? [row, col] : null)
  }

  if (roomStatus === 'waiting') return <div className="glass-card mt-4 p-6 text-center"><p className="text-3xl">⏳</p><p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Aguardando {opponent?.name ?? 'amigo'} aceitar…</p></div>
  if (roomStatus === 'cancelled') return <div className="glass-card mt-4 p-6 text-center font-black">Sala encerrada.</div>

  const status = gameState.phase === 'finished'
    ? gameState.winner === 'draw' ? 'Empate!' : gameState.winner === (isHost ? 'host' : 'guest') ? 'Você venceu!' : `${opponent?.name ?? 'Seu amigo'} venceu!`
    : gameState.checked === gameState.turn ? (myTurn ? 'Seu rei está em xeque!' : 'Rei adversário em xeque!')
      : myTurn ? 'Sua vez' : `Vez de ${opponent?.name ?? 'seu amigo'}`

  return <section className="glass-card mt-4 p-3 sm:p-4" aria-labelledby="chess-title">
    <div className="mb-3 text-center"><h2 id="chess-title" className="font-title text-2xl" style={{ color: '#5B3A8A' }}>♟️ Xadrez</h2><p className="text-sm font-black" role="status" aria-live="polite" style={{ color: myTurn ? '#166534' : '#4B5563' }}>{status}</p></div>
    <div className="mx-auto grid w-full max-w-[34rem] grid-cols-8 overflow-hidden rounded-xl border-4 border-amber-900" role="grid" aria-label={`Tabuleiro de xadrez, você joga com as peças ${isHost ? 'brancas' : 'pretas'}`}>
      {viewSquares.map(([row, col]) => {
        const current = gameState.board[row][col]
        const active = selected?.[0] === row && selected?.[1] === col
        const target = legalTargets.some(([r, c]) => r === row && c === col)
        const coordinate = `${String.fromCharCode(97 + col)}${8 - row}`
        const label = current ? `${PIECE_NAMES[current.type]} ${current.color === 'white' ? 'branco' : 'preto'} em ${coordinate}` : `Casa ${coordinate} vazia`
        return <button key={`${row}-${col}`} type="button" role="gridcell" aria-label={label} aria-selected={active} disabled={submitting} onClick={() => void chooseSquare(row, col)}
          className="relative flex aspect-square min-h-9 items-center justify-center text-[clamp(1.45rem,7vw,3rem)] leading-none focus:z-10 focus:outline focus:outline-4 focus:outline-blue-600"
          style={{ background: active ? '#FDE047' : target ? '#86EFAC' : (row + col) % 2 ? '#A16207' : '#FEF3C7', color: current?.color === 'white' ? '#FFFFFF' : '#111827', textShadow: current?.color === 'white' ? '0 1px 2px #111827' : '0 1px 1px #FFFFFF' }}>
          {current ? SYMBOLS[`${current.color}${current.type}`] : target ? <span className="h-3 w-3 rounded-full bg-green-800/70" aria-hidden="true" /> : null}
        </button>
      })}
    </div>
    <p className="mx-auto mt-3 max-w-xl text-center text-xs font-bold" style={{ color: '#4B5563' }}>Toque em uma peça e depois numa casa verde. Inclui roque, en passant, xeque-mate e promoção automática do peão para dama.</p>
  </section>
}
