import { useCallback, useEffect, useRef, useState } from 'react'
import type { OnlinePlayer } from '../../online/types'

interface Props {
  isHost: boolean
  roomStatus: string
  opponent: OnlinePlayer | null
  broadcastGameState: unknown
  guestMove: unknown
  stateRequest: number
  onBroadcastState: (s: unknown) => void
  onBroadcastMove: (m: unknown) => void
  onFinish: (winner: 'host' | 'guest' | 'draw') => Promise<void>
}

type Piece = { role: 'host' | 'guest'; king: boolean } | null
type Board = (Piece)[][]
type Pos = [number, number]

function initBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null))
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = { role: 'guest', king: false }
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = { role: 'host', king: false }
  return b
}

interface GS { board: Board; turn: 'host' | 'guest'; hostCaptures: number; guestCaptures: number; phase: 'playing' | 'finished'; winner: 'host' | 'guest' | 'draw' | null }
const INIT_GS: GS = { board: [], turn: 'host', hostCaptures: 0, guestCaptures: 0, phase: 'playing', winner: null }

function getMoves(board: Board, role: 'host' | 'guest'): { from: Pos; to: Pos; capture?: Pos }[] {
  const dir = role === 'host' ? -1 : 1
  const moves: { from: Pos; to: Pos; capture?: Pos }[] = []
  const captures: { from: Pos; to: Pos; capture: Pos }[] = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p || p.role !== role) continue
      const dirs = p.king ? [-1, 1] : [dir]
      for (const dr of dirs) {
        for (const dc of [-1, 1]) {
          const nr = r + dr; const nc = c + dc
          if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue
          if (!board[nr][nc]) { moves.push({ from: [r, c], to: [nr, nc] }) }
          else if (board[nr][nc]?.role !== role) {
            const jr = nr + dr; const jc = nc + dc
            if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr][jc]) {
              captures.push({ from: [r, c], to: [jr, jc], capture: [nr, nc] })
            }
          }
        }
      }
    }
  }
  return captures.length ? captures : moves
}

function applyMove(gs: GS, from: Pos, to: Pos): GS {
  const board = gs.board.map(r => [...r]) as Board
  const piece = board[from[0]][from[1]]!
  board[to[0]][to[1]] = { ...piece, king: piece.king || to[0] === 0 || to[0] === 7 }
  board[from[0]][from[1]] = null
  let hc = gs.hostCaptures, gc = gs.guestCaptures
  if (Math.abs(from[0] - to[0]) === 2) {
    const mr = (from[0] + to[0]) / 2; const mc = (from[1] + to[1]) / 2
    if (board[mr][mc]?.role === 'guest') hc++; else gc++
    board[mr][mc] = null
  }
  const nextTurn: 'host' | 'guest' = gs.turn === 'host' ? 'guest' : 'host'
  const nextMoves = getMoves(board, nextTurn)
  const hostPieces = board.flat().filter(p => p?.role === 'host').length
  const guestPieces = board.flat().filter(p => p?.role === 'guest').length
  let phase: 'playing' | 'finished' = 'playing'
  let winner: GS['winner'] = null
  if (hostPieces === 0 || (nextTurn === 'host' && nextMoves.length === 0)) { phase = 'finished'; winner = 'guest' }
  else if (guestPieces === 0 || (nextTurn === 'guest' && nextMoves.length === 0)) { phase = 'finished'; winner = 'host' }
  return { board, turn: nextTurn, hostCaptures: hc, guestCaptures: gc, phase, winner }
}

export default function OnlineCheckersBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, stateRequest, onBroadcastState, onBroadcastMove, onFinish }: Props) {
  const [gs, setGs] = useState<GS>(INIT_GS)
  const [sel, setSel] = useState<Pos | null>(null)
  const initRef = useRef(false)
  const stateRef = useRef(gs)
  stateRef.current = gs

  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initRef.current) return
    initRef.current = true
    const s: GS = { ...INIT_GS, board: initBoard() }
    setGs(s); onBroadcastState(s)
  }, [isHost, roomStatus, onBroadcastState])

  useEffect(() => { if (!isHost && broadcastGameState) setGs(broadcastGameState as GS) }, [isHost, broadcastGameState])

  useEffect(() => {
    if (isHost && stateRequest > 0 && initRef.current) onBroadcastState(stateRef.current)
  }, [isHost, onBroadcastState, stateRequest])

  const doMove = useCallback((from: Pos, to: Pos) => {
    setGs(prev => {
      const next = applyMove(prev, from, to)
      onBroadcastState(next)
      return next
    })
    setSel(null)
  }, [onBroadcastState])

  useEffect(() => {
    if (!isHost || !guestMove) return
    const m = guestMove as { from?: Pos; to?: Pos }
    if (m.from && m.to) doMove(m.from, m.to)
  }, [guestMove, isHost, doMove])

  useEffect(() => { if (gs.phase === 'finished' && gs.winner) void onFinish(gs.winner) }, [gs.phase, gs.winner, onFinish])

  const myRole = isHost ? 'host' : 'guest'
  const myTurn = gs.turn === myRole
  const validMoves = gs.board.length ? getMoves(gs.board, myRole) : []

  const handleClick = (r: number, c: number) => {
    if (!myTurn || gs.phase !== 'playing' || gs.board.length === 0) return
    const piece = gs.board[r][c]
    if (sel) {
      const move = validMoves.find(m => m.from[0] === sel[0] && m.from[1] === sel[1] && m.to[0] === r && m.to[1] === c)
      if (move) {
        if (isHost) doMove(sel, [r, c])
        else onBroadcastMove({ from: sel, to: [r, c] })
        setSel(null)
      } else if (piece?.role === myRole) setSel([r, c])
      else setSel(null)
    } else if (piece?.role === myRole) setSel([r, c])
  }

  if (roomStatus === 'waiting') return <div className="glass-card mt-4 p-6 text-center"><p className="text-3xl">⏳</p><p className="mt-2 font-black" style={{ color: '#5B3A8A' }}>Aguardando {opponent?.name ?? 'amigo'} aceitar…</p></div>
  if (roomStatus === 'cancelled') return <div className="glass-card mt-4 p-6 text-center"><p className="font-black" style={{ color: '#5B3A8A' }}>Sala encerrada.</p></div>
  if (gs.board.length === 0) return <div className="glass-card mt-4 p-6 text-center"><p className="animate-pulse font-black" style={{ color: '#5B3A8A' }}>Preparando tabuleiro…</p></div>

  return (
    <div className="mt-4">
      <div className="glass-card mb-3 flex items-center justify-between px-4 py-2 text-sm font-black">
        <span style={{ color: '#4A90D9' }}>Você ({isHost ? '🔴' : '⚫'}) {isHost ? gs.hostCaptures : gs.guestCaptures} cap.</span>
        <span className={myTurn ? 'text-green-700' : 'text-gray-500'}>{gs.phase === 'finished' ? (gs.winner === myRole ? '🎉 Venceu!' : '😔 Perdeu!') : myTurn ? 'Sua vez!' : 'Vez do amigo…'}</span>
        <span style={{ color: '#7B5EA7' }}>{opponent?.name ?? 'Amigo'} {!isHost ? gs.hostCaptures : gs.guestCaptures} cap.</span>
      </div>
      <div className="grid grid-cols-8 gap-0.5 rounded-2xl overflow-hidden">
        {gs.board.flatMap((row, r) => row.map((cell, c) => {
          const dark = (r + c) % 2 === 1
          const isSelected = sel && sel[0] === r && sel[1] === c
          const isTarget = sel ? validMoves.some(m => m.from[0] === sel[0] && m.from[1] === sel[1] && m.to[0] === r && m.to[1] === c) : false
          return (
            <button key={`${r}-${c}`} type="button" onClick={() => handleClick(r, c)}
              className="aspect-square flex items-center justify-center text-xl"
              style={{ background: isSelected ? '#FDE68A' : isTarget ? '#BBF7D0' : dark ? '#4B5563' : '#F9FAFB' }}>
              {cell ? <span style={{ fontSize: 22, filter: cell.role === 'host' ? 'none' : 'brightness(0)' }}>
                {cell.king ? '👑' : cell.role === 'host' ? '🔴' : '⚫'}
              </span> : null}
            </button>
          )
        }))}
      </div>
    </div>
  )
}
