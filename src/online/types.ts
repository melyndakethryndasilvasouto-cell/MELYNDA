export type OnlineStatus = 'idle' | 'connecting' | 'connected' | 'error'
export type RoomStatus = 'waiting' | 'active' | 'finished' | 'cancelled'
export type TicTacToeCell = 'X' | 'O' | null

export interface OnlinePlayer {
  userId: string
  name: string
  avatar: string
}

export interface OnlineInvite {
  id: string
  room_id: string
  from_user: string
  to_user: string
  from_name: string
  from_avatar: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at: string
}

export interface OnlineRoomState {
  board: TicTacToeCell[]
  turn: 'X' | 'O'
  result: 'playing' | 'X' | 'O' | 'draw'
  round: number
}

export interface OnlineRoom {
  id: string
  game: 'tic-tac-toe'
  host_id: string
  guest_id: string | null
  status: RoomStatus
  state: OnlineRoomState
  version: number
}

export const LOBBY_QUICK_MESSAGES = [
  'Oi! Vamos jogar?',
  'Alguém quer uma partida?',
  'Boa sorte e divirta-se!',
  'Deus abençoe sua partida!',
] as const

export { cleanRoomMessage } from './messageRules.mjs'
