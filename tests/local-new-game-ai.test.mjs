import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { STOP_CATEGORIES, STOP_LETTERS, validStopAnswer } from '../src/online/newGameRules.mjs'
import {
  ADEDONHA_ANSWER_BANK,
  LOCAL_DIFFICULTIES,
  chooseAdedonhaLetter,
  chooseRpsAiChoice,
  createAdedonhaAiAnswers,
  resolveLocalRpsRound,
  scoreLocalAdedonhaRound,
  validateAdedonhaAnswerBank,
} from '../src/online/localGameAi.mjs'

const root = new URL('../', import.meta.url)
const fixedRandom = value => () => value

test('IA local de pedra, papel e tesoura oferece três estratégias válidas e justas', () => {
  assert.deepEqual(LOCAL_DIFFICULTIES, ['easy', 'medium', 'hard'])
  assert.equal(chooseRpsAiChoice('easy', ['rock'], fixedRandom(0)), 'scissors', 'fácil favorece o aprendizado')
  assert.equal(chooseRpsAiChoice('medium', ['rock', 'rock', 'paper'], fixedRandom(0)), 'paper', 'médio combate a escolha mais frequente')
  assert.equal(chooseRpsAiChoice('hard', ['rock', 'paper', 'rock', 'scissors', 'rock'], fixedRandom(0)), 'scissors', 'difícil usa a transição mais provável')

  for (const difficulty of LOCAL_DIFFICULTIES) {
    const choice = chooseRpsAiChoice(difficulty, ['invalid', 'paper'], fixedRandom(0.99))
    assert.ok(['rock', 'paper', 'scissors'].includes(choice))
  }
})

test('resultado local de pedra, papel e tesoura preserva as regras oficiais', () => {
  assert.equal(resolveLocalRpsRound('rock', 'scissors'), 'player')
  assert.equal(resolveLocalRpsRound('paper', 'scissors'), 'system')
  assert.equal(resolveLocalRpsRound('paper', 'paper'), 'draw')
  assert.equal(resolveLocalRpsRound('invalid', 'paper'), null)
})

test('banco local da Adedonha cobre todas as letras e categorias com respostas válidas', () => {
  assert.equal(validateAdedonhaAnswerBank(), true)
  assert.deepEqual(Object.keys(ADEDONHA_ANSWER_BANK).sort(), [...STOP_LETTERS].sort())
  for (const letter of STOP_LETTERS) {
    assert.deepEqual(Object.keys(ADEDONHA_ANSWER_BANK[letter]), STOP_CATEGORIES.map(category => category.key))
    for (const category of STOP_CATEGORIES) {
      assert.equal(validStopAnswer(ADEDONHA_ANSWER_BANK[letter][category.key], letter), true, `${letter}/${category.key}`)
    }
  }
})

test('níveis da Adedonha usam letras e quantidades de respostas distintas', () => {
  assert.equal(chooseAdedonhaLetter('easy', fixedRandom(0)), 'A')
  assert.equal(chooseAdedonhaLetter('easy', fixedRandom(0.999)), 'S')
  assert.equal(chooseAdedonhaLetter('medium', fixedRandom(0.999)), 'T')
  assert.equal(chooseAdedonhaLetter('hard', fixedRandom(0.999)), 'V')

  const completed = difficulty => Object.values(createAdedonhaAiAnswers('A', difficulty)).filter(Boolean).length
  assert.equal(completed('easy'), 4)
  assert.equal(completed('medium'), 6)
  assert.equal(completed('hard'), 8)
})

test('pontuação local da Adedonha reutiliza validação, duplicidade e limite das oito categorias', () => {
  const playerAnswers = { ...ADEDONHA_ANSWER_BANK.A, ignored: 'Arquivo secreto' }
  const easy = scoreLocalAdedonhaRound('A', playerAnswers, 'easy')
  const hard = scoreLocalAdedonhaRound('A', playerAnswers, 'hard')
  assert.equal(easy.rows.length, 8)
  assert.equal(easy.guestScore, 20, 'quatro respostas iguais valem cinco pontos cada')
  assert.equal(hard.guestScore, 40, 'oito respostas iguais valem cinco pontos cada')
  assert.equal(hard.hostScore, 40)
  assert.equal('ignored' in hard.systemAnswers, false)
})

test('interfaces locais são acessíveis, responsivas e não enviam nem persistem respostas', async () => {
  const [rps, adedonha, ai] = await Promise.all([
    readFile(new URL('src/games/RockPaperScissors/index.tsx', root), 'utf8'),
    readFile(new URL('src/games/Adedonha/index.tsx', root), 'utf8'),
    readFile(new URL('src/online/localGameAi.mjs', root), 'utf8'),
  ])
  for (const component of [rps, adedonha]) {
    assert.match(component, /aria-labelledby=/)
    assert.match(component, /aria-pressed=/)
    assert.match(component, /sm:grid-cols-3/)
    assert.doesNotMatch(component, /dangerouslySetInnerHTML|innerHTML\s*=/)
  }
  assert.match(rps, /sem ver sua escolha atual/)
  assert.match(rps, /newMatchRef\.current\?\.focus/)
  assert.match(adedonha, /Esta partida é local: nada é enviado ou salvo/)
  assert.match(adedonha, /resultStatusRef\.current\?\.focus/)
  assert.doesNotMatch(adedonha + ai, /fetch\s*\(|localStorage|sessionStorage|supabase/i)
})
