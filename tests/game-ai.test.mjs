import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { shouldContinueAiTurn } from '../src/games/Memory/aiTurnRules.mjs'

const root = new URL('../', import.meta.url)

test('memória libera uma nova jogada quando o computador acerta sem encerrar a partida', async () => {
  assert.equal(shouldContinueAiTurn({ mode: 'ai', currentPlayer: 2, matchedPairs: 2, totalPairs: 6 }), true)
  assert.equal(shouldContinueAiTurn({ mode: 'ai', currentPlayer: 2, matchedPairs: 6, totalPairs: 6 }), false)
  assert.equal(shouldContinueAiTurn({ mode: 'two', currentPlayer: 2, matchedPairs: 2, totalPairs: 6 }), false)

  const source = await readFile(new URL('src/games/Memory/index.tsx', root), 'utf8')
  assert.match(source, /shouldContinueAiTurn/)
  assert.match(source, /lockedRef\.current\s*=\s*true[\s\S]*setLocked\(true\)/)
})

test('os demais jogos preservam motores locais para o computador', async () => {
  const files = await Promise.all([
    readFile(new URL('src/games/TicTacToe/index.tsx', root), 'utf8'),
    readFile(new URL('src/games/Checkers/index.tsx', root), 'utf8'),
    readFile(new URL('src/games/Uno/index.tsx', root), 'utf8'),
    readFile(new URL('src/games/Pong/index.tsx', root), 'utf8'),
  ])

  assert.match(files[0], /bestMove\(prev\)|randomMove\(prev\)/)
  assert.match(files[1], /aiPickMove\(board, diff\)/)
  assert.match(files[1], /const moves = getValidMoves\(board, currentPlayer\)[\s\S]*if \(moves\.length === 0\)/)
  assert.doesNotMatch(files[1], /if \(allMoves\.length === 0\)/)
  assert.match(files[2], /aiChooseCard\(cur\.hand, top, s\.activeColor\)/)
  assert.match(files[3], /const aiSpeed =/)
  for (const source of files) assert.doesNotMatch(source, /GROQ_API_KEY|api\.groq\.com/)
})
