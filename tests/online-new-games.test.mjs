import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { applyChessMove, createChessState, legalChessMoves, validChessState } from '../src/online/chessRules.mjs'
import { cleanStopAnswers, rpsRoundWinner, scoreStopRound, validStopAnswer } from '../src/online/newGameRules.mjs'

const root = new URL('../', import.meta.url)
const move = (state, from, to) => applyChessMove(state, from, to)

test('xadrez inicia completo e só aceita movimentos legais do jogador da vez', () => {
  const state = createChessState()
  assert.equal(validChessState(state), true)
  assert.equal(state.board.flat().filter(Boolean).length, 32)
  assert.deepEqual(legalChessMoves(state, [6, 4]), [[5, 4], [4, 4]])
  assert.strictEqual(move(state, [7, 0], [5, 0]), state, 'torre não atravessa o próprio peão')
  assert.strictEqual(move(state, [1, 4], [3, 4]), state, 'pretas não jogam na vez das brancas')
})

test('xadrez reconhece xeque-mate e entrega a vitória ao lado correto', () => {
  let state = createChessState()
  state = move(state, [6, 5], [5, 5])
  state = move(state, [1, 4], [3, 4])
  state = move(state, [6, 6], [4, 6])
  state = move(state, [0, 3], [4, 7])
  assert.equal(state.phase, 'finished')
  assert.equal(state.winner, 'guest')
  assert.equal(state.checked, 'white')
})

test('xadrez oferece roque, en passant e promoção automática', () => {
  let castle = createChessState()
  castle = move(castle, [6, 4], [4, 4])
  castle = move(castle, [1, 0], [2, 0])
  castle = move(castle, [7, 6], [5, 5])
  castle = move(castle, [2, 0], [3, 0])
  castle = move(castle, [7, 5], [6, 4])
  castle = move(castle, [1, 1], [2, 1])
  castle = move(castle, [7, 4], [7, 6])
  assert.equal(castle.board[7][6]?.type, 'king')
  assert.equal(castle.board[7][5]?.type, 'rook')

  let passant = createChessState()
  passant = move(passant, [6, 4], [4, 4])
  passant = move(passant, [1, 0], [2, 0])
  passant = move(passant, [4, 4], [3, 4])
  passant = move(passant, [1, 3], [3, 3])
  passant = move(passant, [3, 4], [2, 3])
  assert.equal(passant.board[3][3], null)
  assert.equal(passant.board[2][3]?.type, 'pawn')

  const promotion = createChessState()
  promotion.board = Array.from({ length: 8 }, () => Array(8).fill(null))
  promotion.board[7][4] = { type: 'king', color: 'white' }
  promotion.board[0][4] = { type: 'king', color: 'black' }
  promotion.board[1][0] = { type: 'pawn', color: 'white' }
  const promoted = move(promotion, [1, 0], [0, 0])
  assert.equal(promoted.board[0][0]?.type, 'queen')
})

test('pedra, papel e tesoura cobre empates e as seis vitórias possíveis', () => {
  assert.equal(rpsRoundWinner('rock', 'rock'), 'draw')
  assert.equal(rpsRoundWinner('rock', 'scissors'), 'host')
  assert.equal(rpsRoundWinner('paper', 'rock'), 'host')
  assert.equal(rpsRoundWinner('scissors', 'paper'), 'host')
  assert.equal(rpsRoundWinner('scissors', 'rock'), 'guest')
  assert.equal(rpsRoundWinner('rock', 'paper'), 'guest')
  assert.equal(rpsRoundWinner('paper', 'scissors'), 'guest')
  assert.equal(rpsRoundWinner('invalid', 'rock'), null)
})

test('Adedonha limpa campos, aceita acentos e pontua respostas únicas ou repetidas', () => {
  assert.equal(validStopAnswer('Águia', 'A'), true)
  assert.equal(validStopAnswer('Brasil', 'A'), false)
  assert.equal(validStopAnswer('A1', 'A'), false)
  const host = { name: 'Ana', animal: 'Arara', food: 'Arroz', country: 'Argentina', city: 'Anápolis', state: 'Amazonas', object: 'Agulha', bible: 'Abraão', ignored: 'não entra' }
  const guest = { name: 'Abel', animal: 'Arara', food: 'Abacate', country: 'Angola', city: 'Atenas', state: '', object: 'Anel', bible: 'Atos' }
  const cleaned = cleanStopAnswers(host)
  assert.equal(Object.keys(cleaned).length, 8)
  assert.equal('ignored' in cleaned, false)
  const result = scoreStopRound('A', host, guest)
  assert.equal(result.rows.find(row => row.key === 'animal')?.hostScore, 5)
  assert.equal(result.rows.find(row => row.key === 'animal')?.guestScore, 5)
  assert.equal(result.rows.find(row => row.key === 'state')?.guestScore, 0)
  assert.equal(result.hostScore, 75)
  assert.equal(result.guestScore, 65)
})

test('catálogo, sala e migração conectam os três novos jogos com validação privada', async () => {
  const [types, registry, room, migration, chessBoard, rpsBoard, adedonhaBoard, home, lobby] = await Promise.all([
    readFile(new URL('src/online/types.ts', root), 'utf8'),
    readFile(new URL('src/online/gameRegistry.ts', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineRoomPage.tsx', root), 'utf8'),
    readFile(new URL('supabase/migrations/20260912120000_add_online_strategy_word_games.sql', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineChessBoard.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineRockPaperScissorsBoard.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineAdedonhaBoard.tsx', root), 'utf8'),
    readFile(new URL('src/components/Home/HomePage.tsx', root), 'utf8'),
    readFile(new URL('src/components/Online/OnlineLobbyPage.tsx', root), 'utf8'),
  ])
  for (const game of ['chess', 'rock-paper-scissors', 'adedonha']) {
    assert.match(types, new RegExp(`'${game}'`))
    assert.match(registry, new RegExp(`(?:key: '${game}'|${game}:|'${game}':)`))
    assert.match(room, new RegExp(`room\\.game === '${game}'`))
    assert.match(migration, new RegExp(`'${game}'`))
  }
  assert.match(migration, /octet_length\(action::text\) > 1200/)
  assert.match(migration, /select count\(\*\) from jsonb_object_keys\(action->'answers'\)/)
  assert.match(migration, /current_room\.game in \('rock-paper-scissors', 'adedonha'\)[\s\S]*jsonb_build_object\('type', action_type\)/)
  assert.match(migration, /current_room\.game <> 'tic-tac-toe' and caller <> current_room\.host_id[\s\S]*NOT_AUTHORITATIVE_HOST/)
  assert.doesNotMatch(chessBoard + rpsBoard + adedonhaBoard, /dangerouslySetInnerHTML|innerHTML\s*=/)
  for (const board of [chessBoard, rpsBoard, adedonhaBoard]) {
    assert.match(board, /stateRequest/)
    assert.match(board, /onValidateAction/)
    assert.match(board, /aria-/)
  }
  assert.match(adedonhaBoard, /não escreva seu nome completo/)
  assert.match(rpsBoard, /escolha fica escondida/)
  for (const [name, key] of [['Xadrez', 'chess'], ['Pedra, Papel e Tesoura', 'rock-paper-scissors'], ['Adedonha', 'adedonha']]) {
    assert.match(home, new RegExp(`name: '${name}'`))
    assert.match(home, new RegExp(`/online\\?jogo=${key}`))
  }
  assert.match(lobby, /data-preferred-online-game/)
  assert.match(lobby, /Você escolheu \{preferredGame\.label\}/)
})
