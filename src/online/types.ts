export type OnlineStatus = 'idle' | 'connecting' | 'connected' | 'error'
export type RoomStatus = 'waiting' | 'active' | 'finished' | 'cancelled'
export type TicTacToeCell = 'X' | 'O' | null
export type OnlineActivity = 'lobby' | 'playing' | 'group' | 'away'
export type OnlineGameKey = 'memory' | 'tic-tac-toe' | 'checkers' | 'uno' | 'coloring' | 'snake' | 'simon' | 'quiz' | 'puzzle' | 'pong' | 'hangman'

export interface OnlinePlayer {
  userId: string
  name: string
  avatar: string
  activity: OnlineActivity
  gameKey: OnlineGameKey | null
  updatedAt: string
}

export interface OnlineInvite {
  id: string
  room_id: string
  from_user: string
  to_user: string
  from_name: string
  from_avatar: string
  game?: OnlineGameType
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  expires_at: string
}

export interface OnlineGroup {
  id: string
  owner_id: string
  name: string
  status: 'active' | 'closed'
  max_members: number
  created_at: string
  updated_at: string
}

export interface OnlineGroupMember {
  group_id: string
  user_id: string
  role: 'owner' | 'member'
  display_name: string
  avatar: string
  joined_at: string
}

export interface OnlineGroupInvite {
  id: string
  group_id: string
  from_user: string
  to_user: string
  from_name: string
  from_avatar: string
  group_name: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
  created_at: string
  expires_at: string
}

export interface OnlineChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_avatar: string
  kind: 'text' | 'audio'
  body: string | null
  audio_data: string | null
  audio_mime: string | null
  audio_duration_ms: number | null
  created_at: string
  expires_at: string
}

export interface OnlineLobbyMessage {
  id: string
  senderId: string
  name: string
  avatar: string
  text: string
}

export interface OnlineRoomStateTTT {
  board: TicTacToeCell[]
  turn: 'X' | 'O'
  result: 'playing' | 'X' | 'O' | 'draw'
  round: number
}

// Generic state for broadcast-based games (Memory, Checkers, Quiz, Pong)
export interface OnlineRoomStateGeneric {
  result: 'playing' | 'host' | 'guest' | 'draw' | 'finished'
  round: number
  winner?: string | null
  [key: string]: unknown
}

export type OnlineRoomState = OnlineRoomStateTTT | OnlineRoomStateGeneric

export type OnlineGameType = OnlineGameKey

export interface OnlineRoom {
  id: string
  game: OnlineGameType
  host_id: string
  guest_id: string | null
  status: RoomStatus
  state: OnlineRoomState
  version: number
}

// Broadcast message types for non-TTT games
export interface OnlineBroadcastGameState {
  type: 'full-state'
  gameState: unknown
  hostScore?: number
  guestScore?: number
}

export interface OnlineBroadcastMove {
  type: 'move'
  move: unknown
}

export type OnlineBroadcastPayload = OnlineBroadcastGameState | OnlineBroadcastMove

export const LOBBY_QUICK_MESSAGES = [
  'Oi! Vamos jogar?',
  'Alguém quer uma partida?',
  'Boa sorte e divirta-se!',
  'Deus abençoe sua partida!',
] as const

export { cleanRoomMessage } from './messageRules.mjs'
