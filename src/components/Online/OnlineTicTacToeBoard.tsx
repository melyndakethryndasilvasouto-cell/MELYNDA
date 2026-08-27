import { useCallback, useEffect, useRef, useState } from 'react'
import { OnlinePlayer } from '../../online/types'
import { useSound } from '../../contexts/SoundContext'
import confetti from 'canvas-confetti'

interface Props {
  isHost: boolean
  roomStatus: 'waiting' | 'active' | 'finished' | 'cancelled'
  opponent: OnlinePlayer | null
  broadcastGameState: unknown
  guestMove: unknown
  onBroadcastState: (state: unknown) => void
  onBroadcastMove: (move: unknown) => void
  onFinish: (winner: 'host' | 'guest' | 'draw') => void
}

type GS = {
  board: (string | null)[]
  turn: 'X' | 'O'
  hostScore: number
  guestScore: number
  bestOf: number
  phase: 'config' | 'playing' | 'round_end' | 'match_end'
  winner: 'X' | 'O' | 'draw' | null
  matchWinner: 'host' | 'guest' | 'draw' | null
  hostSymbol: 'X' | 'O'
  roundStarter: 'host' | 'guest'
}

const INIT_GS: GS = {
  board: Array(9).fill(null),
  turn: 'X',
  hostScore: 0,
  guestScore: 0,
  bestOf: 3,
  phase: 'config',
  winner: null,
  matchWinner: null,
  hostSymbol: 'X',
  roundStarter: 'host'
}

function checkWin(b: (string | null)[]) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ]
  for (let l of lines) {
    if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return b[l[0]] as 'X' | 'O'
  }
  if (!b.includes(null)) return 'draw'
  return null
}

export default function OnlineTicTacToeBoard({ isHost, roomStatus, opponent, broadcastGameState, guestMove, onBroadcastState, onBroadcastMove, onFinish }: Props) {
  const { playSound } = useSound()
  const [gs, setGs] = useState<GS>(INIT_GS)
  const initRef = useRef(false)

  // Host initializes
  useEffect(() => {
    if (!isHost || roomStatus !== 'active' || initRef.current) return
    initRef.current = true
    setGs(INIT_GS)
    onBroadcastState(INIT_GS)
  }, [isHost, roomStatus, onBroadcastState])

  // Sync Guest
  useEffect(() => {
    if (!isHost && broadcastGameState) {
      setGs(broadcastGameState as GS)
    }
  }, [isHost, broadcastGameState])

  // Host handles guest moves
  useEffect(() => {
    if (!isHost || !guestMove) return
    const m = guestMove as { type: string; idx?: number }
    if (m.type === 'play' && typeof m.idx === 'number') {
      doMove(m.idx, false) // guest is false
    }
  }, [guestMove]) // eslint-disable-line

  const doMove = useCallback((idx: number, isHostMove: boolean) => {
    setGs(prev => {
      if (prev.phase !== 'playing') return prev
      const isMyTurn = (isHostMove && prev.turn === prev.hostSymbol) || (!isHostMove && prev.turn !== prev.hostSymbol)
      if (!isMyTurn || prev.board[idx] !== null) return prev

      const nextBoard = [...prev.board]
      nextBoard[idx] = prev.turn
      const result = checkWin(nextBoard)
      
      let nextGs = { ...prev, board: nextBoard, turn: (prev.turn === 'X' ? 'O' : 'X') as ('X' | 'O') }

      if (result) {
        playSound(result === 'draw' ? 'lose' : 'win')
        if (result !== 'draw') confetti({ particleCount: 50, spread: 60 })

        let hs = prev.hostScore
        let gsScore = prev.guestScore
        if (result === prev.hostSymbol) hs++
        else if (result !== 'draw') gsScore++

        const target = Math.ceil(prev.bestOf / 2)
        const matchOver = hs >= target || gsScore >= target

        nextGs = { 
          ...nextGs, 
          phase: matchOver ? 'match_end' : 'round_end',
          winner: result,
          hostScore: hs,
          guestScore: gsScore,
          matchWinner: matchOver ? (hs > gsScore ? 'host' : 'guest') : null
        }
      } else {
        playSound('click')
      }

      onBroadcastState(nextGs)
      return nextGs
    })
  }, [onBroadcastState])

  const handleCellClick = (idx: number) => {
    if (gs.phase !== 'playing' || gs.board[idx] !== null) return
    const mySymbol = isHost ? gs.hostSymbol : (gs.hostSymbol === 'X' ? 'O' : 'X')
    if (gs.turn !== mySymbol) return

    if (isHost) doMove(idx, true)
    else onBroadcastMove({ type: 'play', idx })
  }

  const handleNextRound = () => {
    if (!isHost) return
    const nextStarter = gs.roundStarter === 'host' ? 'guest' : 'host'
    const nextSymbol = gs.hostSymbol === 'X' ? 'O' : 'X' // alternate symbols every round
    const nextGs: GS = {
      ...gs,
      board: Array(9).fill(null),
      phase: 'playing',
      winner: null,
      hostSymbol: nextSymbol,
      roundStarter: nextStarter,
      turn: 'X' // X always goes first in TicTacToe
    }
    setGs(nextGs)
    onBroadcastState(nextGs)
  }

  const handleStartMatch = (bestOf: number) => {
    if (!isHost) return
    const nextGs: GS = { ...INIT_GS, bestOf, phase: 'playing' }
    setGs(nextGs)
    onBroadcastState(nextGs)
  }

  const myScore = isHost ? gs.hostScore : gs.guestScore
  const oppScore = isHost ? gs.guestScore : gs.hostScore
  const mySymbol = isHost ? gs.hostSymbol : (gs.hostSymbol === 'X' ? 'O' : 'X')
  const myTurn = gs.turn === mySymbol && gs.phase === 'playing'

  if (roomStatus === 'waiting') {
    return (
      <div className="glass-card mt-4 p-6 text-center">
        <p className="text-3xl">⏳</p>
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
            {[3, 5, 7].map(bo => (
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

  return (
    <div className="mt-4 flex flex-col items-center">
      {/* Scoreboard */}
      <div className="glass-card flex w-full max-w-[340px] items-center justify-between p-3 px-6 mb-4">
        <div className="text-center">
          <p className="text-xs font-black uppercase text-blue-600">Você</p>
          <p className="text-2xl font-black text-blue-600">{myScore}</p>
        </div>
        <div className="text-center flex-1 mx-4">
          <p className="text-xs font-black text-gray-400">MELHOR DE {gs.bestOf}</p>
          <p className="text-sm font-bold mt-1" style={{ color: myTurn ? '#166534' : '#6B7280' }}>
            {gs.phase === 'playing' ? (myTurn ? 'Sua vez!' : `Vez de ${opponent?.name}`) : 'Rodada Encerrada'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-black uppercase text-purple-600 truncate max-w-[80px]">{opponent?.name ?? 'Oponente'}</p>
          <p className="text-2xl font-black text-purple-600">{oppScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-[340px]">
        {gs.board.map((cell, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleCellClick(idx)}
            disabled={gs.phase !== 'playing' || cell !== null || !myTurn}
            className="flex aspect-square items-center justify-center rounded-3xl bg-white text-5xl font-black shadow-md transition-transform enabled:active:scale-90 disabled:cursor-default"
            style={{ color: cell === mySymbol ? '#4A90D9' : '#DC2626' }}
          >
            {cell}
          </button>
        ))}
      </div>

      {gs.phase === 'round_end' && (
        <div className="glass-card mt-6 p-4 text-center w-full max-w-[340px]">
          <h3 className="text-xl font-bold mb-3 text-purple-800">
            {gs.winner === 'draw' ? 'Empatou!' : gs.winner === mySymbol ? 'Você ganhou a rodada!' : `${opponent?.name} ganhou a rodada!`}
          </h3>
          {isHost ? (
            <button className="btn-primary w-full py-2" onClick={handleNextRound}>Próxima Rodada</button>
          ) : (
            <p className="text-sm text-gray-500">Aguardando anfitrião iniciar...</p>
          )}
        </div>
      )}

      {gs.phase === 'match_end' && (
        <div className="glass-card mt-6 p-4 text-center w-full max-w-[340px]">
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
