import type { OnlineActivity, OnlineGameKey } from './types'

export const ONLINE_GAME_LABELS: Record<OnlineGameKey, string> = {
  memory: 'Memória da Bíblia',
  'tic-tac-toe': 'Jogo da Velha',
  checkers: 'Dama',
  chess: 'Xadrez',
  'rock-paper-scissors': 'Pedra, Papel e Tesoura',
  adedonha: 'Adedonha',
  uno: 'UNO',
  coloring: 'Colorindo a Bíblia',
  snake: 'Cobrinha',
  simon: 'Sequência de Cores',
  quiz: 'Quiz da Bíblia',
  puzzle: 'Quebra-Cabeça',
  pong: 'Ping Pong',
  hangman: 'Forca Bíblica',
}

export const ONLINE_GAME_OPTIONS = [
  { key: 'tic-tac-toe', emoji: '❌⭕', label: ONLINE_GAME_LABELS['tic-tac-toe'] },
  { key: 'uno', emoji: '🃏', label: ONLINE_GAME_LABELS.uno },
  { key: 'memory', emoji: '🎴', label: ONLINE_GAME_LABELS.memory },
  { key: 'checkers', emoji: '🏁', label: ONLINE_GAME_LABELS.checkers },
  { key: 'chess', emoji: '♟️', label: ONLINE_GAME_LABELS.chess },
  { key: 'rock-paper-scissors', emoji: '✊', label: ONLINE_GAME_LABELS['rock-paper-scissors'] },
  { key: 'adedonha', emoji: '📝', label: ONLINE_GAME_LABELS.adedonha },
  { key: 'quiz', emoji: '❓', label: ONLINE_GAME_LABELS.quiz },
  { key: 'coloring', emoji: '🎨', label: ONLINE_GAME_LABELS.coloring },
  { key: 'snake', emoji: '🐍', label: ONLINE_GAME_LABELS.snake },
  { key: 'simon', emoji: '🔴', label: ONLINE_GAME_LABELS.simon },
  { key: 'puzzle', emoji: '🧩', label: ONLINE_GAME_LABELS.puzzle },
  { key: 'pong', emoji: '🏓', label: ONLINE_GAME_LABELS.pong },
  { key: 'hangman', emoji: '🔤', label: ONLINE_GAME_LABELS.hangman },
] as const

const SYSTEM_OPPONENT_GAMES = new Set<OnlineGameKey>([
  'memory', 'tic-tac-toe', 'checkers', 'chess', 'rock-paper-scissors', 'adedonha', 'uno', 'pong',
])

export function hasSystemOpponent(gameKey: OnlineGameKey | null): boolean {
  return Boolean(gameKey && SYSTEM_OPPONENT_GAMES.has(gameKey))
}

export const LOCAL_PATH_GAMES: Record<string, OnlineGameKey> = {
  '/memoria': 'memory',
  '/jogo-da-velha': 'tic-tac-toe',
  '/dama': 'checkers',
  '/xadrez': 'chess',
  '/pedra-papel-tesoura': 'rock-paper-scissors',
  '/adedonha': 'adedonha',
  '/uno': 'uno',
  '/colorir': 'coloring',
  '/cobra': 'snake',
  '/simon': 'simon',
  '/quiz': 'quiz',
  '/quebra-cabeca': 'puzzle',
  '/pong': 'pong',
  '/forca': 'hangman',
}

export interface RouteActivity {
  activity: OnlineActivity
  gameKey: OnlineGameKey | null
}

export function activityForPath(pathname: string): RouteActivity {
  if (pathname.startsWith('/online/grupo/')) return { activity: 'group', gameKey: null }
  if (pathname.startsWith('/online/sala/')) return { activity: 'playing', gameKey: 'tic-tac-toe' }
  const gameKey = LOCAL_PATH_GAMES[pathname]
  if (gameKey) return { activity: 'playing', gameKey }
  return { activity: 'lobby', gameKey: null }
}

export function onlineGameForPath(pathname: string): OnlineGameKey | null {
  return LOCAL_PATH_GAMES[pathname] ?? null
}

export function localPathForOnlineGame(gameKey: OnlineGameKey): string | null {
  return Object.entries(LOCAL_PATH_GAMES).find(([, key]) => key === gameKey)?.[0] ?? null
}

export function activityLabel(player: { activity: OnlineActivity; gameKey: OnlineGameKey | null }) {
  if (player.activity === 'group') return 'Conversando em grupo privado'
  if (player.activity === 'playing' && player.gameKey) return `Jogando ${ONLINE_GAME_LABELS[player.gameKey]}`
  if (player.activity === 'away') return 'Ausente por um momento'
  return 'Disponível para conversar ou jogar'
}
