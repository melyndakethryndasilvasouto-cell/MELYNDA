import type { OnlineActivity, OnlineGameKey } from './types'

export const ONLINE_GAME_LABELS: Record<OnlineGameKey, string> = {
  memory: 'Memória da Bíblia',
  'tic-tac-toe': 'Jogo da Velha',
  checkers: 'Dama',
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
  { key: 'quiz', emoji: '❓', label: ONLINE_GAME_LABELS.quiz },
  { key: 'coloring', emoji: '🎨', label: ONLINE_GAME_LABELS.coloring },
  { key: 'snake', emoji: '🐍', label: ONLINE_GAME_LABELS.snake },
  { key: 'simon', emoji: '🔴', label: ONLINE_GAME_LABELS.simon },
  { key: 'puzzle', emoji: '🧩', label: ONLINE_GAME_LABELS.puzzle },
  { key: 'pong', emoji: '🏓', label: ONLINE_GAME_LABELS.pong },
  { key: 'hangman', emoji: '🔤', label: ONLINE_GAME_LABELS.hangman },
] as const

const PATH_GAMES: Record<string, OnlineGameKey> = {
  '/memoria': 'memory',
  '/jogo-da-velha': 'tic-tac-toe',
  '/dama': 'checkers',
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
  const gameKey = PATH_GAMES[pathname]
  if (gameKey) return { activity: 'playing', gameKey }
  return { activity: 'lobby', gameKey: null }
}

export function activityLabel(player: { activity: OnlineActivity; gameKey: OnlineGameKey | null }) {
  if (player.activity === 'group') return 'Conversando em grupo privado'
  if (player.activity === 'playing' && player.gameKey) return `Jogando ${ONLINE_GAME_LABELS[player.gameKey]}`
  if (player.activity === 'away') return 'Ausente por um momento'
  return 'Disponível para conversar ou jogar'
}
