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
}

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
