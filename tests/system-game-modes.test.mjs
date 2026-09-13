import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')

test('todos os jogos compatíveis oferecem entrada online a partir da rota local', async () => {
  const [registry, option, layout] = await Promise.all([
    read('src/online/gameRegistry.ts'),
    read('src/components/shared/OnlineGameOption.tsx'),
    read('src/components/Layout/Layout.tsx'),
  ])
  const mappings = {
    '/memoria': 'memory', '/jogo-da-velha': 'tic-tac-toe', '/dama': 'checkers',
    '/xadrez': 'chess', '/pedra-papel-tesoura': 'rock-paper-scissors', '/adedonha': 'adedonha',
    '/uno': 'uno', '/colorir': 'coloring', '/cobra': 'snake', '/simon': 'simon',
    '/quiz': 'quiz', '/quebra-cabeca': 'puzzle', '/pong': 'pong', '/forca': 'hangman',
  }
  for (const [path, key] of Object.entries(mappings)) assert.match(registry, new RegExp(`'${path}': '${key}'`))
  assert.match(option, /onlineGameForPath/)
  assert.match(option, /\/online\?jogo=\$\{gameKey\}/)
  assert.match(option, /Jogar online/)
  assert.match(layout, /<OnlineGameOption \/>/)
})

test('jogos competitivos locais expõem Fácil, Médio e Difícil contra o sistema', async () => {
  const files = await Promise.all([
    read('src/games/Memory/index.tsx'), read('src/games/TicTacToe/index.tsx'),
    read('src/games/Checkers/index.tsx'), read('src/games/Uno/index.tsx'),
    read('src/games/Pong/index.tsx'), read('src/games/Chess/index.tsx'),
    read('src/games/RockPaperScissors/index.tsx'), read('src/games/Adedonha/index.tsx'),
  ])
  for (const source of files) {
    assert.match(source, /easy/)
    assert.match(source, /medium/)
    assert.match(source, /hard/)
    assert.match(source, /Fácil/)
    assert.match(source, /Médi[oa]/)
    assert.match(source, /Difícil/)
  }
})

test('a página inicial diferencia IA, solo e disponibilidade online', async () => {
  const home = await read('src/components/Home/HomePage.tsx')
  assert.match(home, /IA · ONLINE/)
  assert.match(home, /SOLO · ONLINE/)
  assert.match(home, /Sem ninguém online\?/)
})
