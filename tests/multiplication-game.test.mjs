import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ALL_FACTS,
  MULTIPLIERS,
  TABLES,
  buildAnswerOptions,
  createMixedSession,
  createTableSession,
  factKey,
  getLesson,
  scheduleReview,
  updateFactProgress,
} from '../src/games/Multiplication/learningRules.mjs'

const expectedTables = [2, 3, 4, 5, 6, 7, 8, 9]
const expectedMultipliers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const expectedFacts = expectedTables.flatMap(table =>
  expectedMultipliers.map(multiplier => ({ table, multiplier })),
)

const stableRandom = () => 0.5

test('catálogo cobre exatamente os 80 fatos de 2×1 a 9×10', () => {
  assert.deepEqual(TABLES, expectedTables)
  assert.deepEqual(MULTIPLIERS, expectedMultipliers)
  assert.equal(ALL_FACTS.length, 80)
  assert.deepEqual(
    ALL_FACTS.map(({ table, multiplier }) => ({ table, multiplier })),
    expectedFacts,
  )

  const keys = ALL_FACTS.map(factKey)
  assert.equal(new Set(keys).size, 80)

  for (const table of TABLES) {
    const tableFacts = ALL_FACTS.filter(fact => fact.table === table)
    assert.deepEqual(tableFacts.map(fact => fact.multiplier), expectedMultipliers)
  }
})

test('todos os fatos têm produto, equação, explicação e dica corretos', () => {
  for (const fact of ALL_FACTS) {
    const product = fact.table * fact.multiplier
    const lesson = getLesson(fact)
    const equationNumbers = String(lesson.equation).match(/\d+/g)?.map(Number)

    assert.equal(lesson.answer, product, `produto incorreto para ${factKey(fact)}`)
    assert.deepEqual(
      equationNumbers,
      [fact.table, fact.multiplier, product],
      `equação incorreta para ${factKey(fact)}`,
    )
    assert.ok(
      typeof lesson.explanation === 'string' && lesson.explanation.trim().length >= 10,
      `explicação ausente para ${factKey(fact)}`,
    )
    assert.ok(
      typeof lesson.tip === 'string' && lesson.tip.trim().length >= 10,
      `dica ausente para ${factKey(fact)}`,
    )
  }
})

test('cada fato oferece quatro opções numéricas únicas contendo a resposta', () => {
  for (const fact of ALL_FACTS) {
    const answer = fact.table * fact.multiplier
    const options = buildAnswerOptions(fact, stableRandom)

    assert.equal(options.length, 4, `quantidade de opções inválida para ${factKey(fact)}`)
    assert.equal(new Set(options).size, 4, `opções repetidas para ${factKey(fact)}`)
    assert.ok(options.every(option => Number.isInteger(option) && option > 0), `opção inválida para ${factKey(fact)}`)
    assert.ok(options.includes(answer), `resposta ausente nas opções de ${factKey(fact)}`)
  }
})

test('sessão de cada tabuada cobre uma vez os multiplicadores de 1 a 10', () => {
  for (const table of TABLES) {
    const session = createTableSession(table, stableRandom)

    assert.equal(session.length, 10, `sessão incompleta para a tabuada do ${table}`)
    assert.ok(session.every(fact => fact.table === table), `sessão misturou outra tabuada em ${table}`)
    assert.equal(new Set(session.map(factKey)).size, 10, `sessão repetiu fatos da tabuada do ${table}`)
    assert.deepEqual(
      session.map(fact => fact.multiplier).sort((a, b) => a - b),
      expectedMultipliers,
    )
  }
})

test('sessão mista contém dez fatos únicos e coloca revisões primeiro', () => {
  const reviewFacts = [ALL_FACTS[3], ALL_FACTS[27], ALL_FACTS[64]]
  const reviewKeys = reviewFacts.map(factKey)
  const session = createMixedSession(reviewKeys, stableRandom)

  assert.equal(session.length, 10)
  assert.equal(new Set(session.map(factKey)).size, 10)
  assert.deepEqual(new Set(session.slice(0, reviewKeys.length).map(factKey)), new Set(reviewKeys))
  assert.ok(session.slice(0, reviewKeys.length).every(fact => fact.isReview === true))
  assert.ok(session.every(fact => TABLES.includes(fact.table) && MULTIPLIERS.includes(fact.multiplier)))
})

test('erro é reagendado após duas questões sem duplicar fatos de revisão', () => {
  const missedFact = { table: 7, multiplier: 8 }
  const initialQueue = [
    { table: 2, multiplier: 1 },
    { table: 3, multiplier: 2 },
    { table: 4, multiplier: 3 },
  ]
  const reviewedQueue = scheduleReview(initialQueue, missedFact)

  assert.deepEqual(reviewedQueue.slice(0, 2), initialQueue.slice(0, 2))
  assert.equal(factKey(reviewedQueue[2]), factKey(missedFact))
  assert.equal(reviewedQueue[2].isReview, true)
  assert.equal(reviewedQueue.filter(fact => factKey(fact) === factKey(missedFact)).length, 1)

  const scheduledAgain = scheduleReview(reviewedQueue, missedFact)
  assert.equal(scheduledAgain.filter(fact => factKey(fact) === factKey(missedFact)).length, 1)

  const alreadyReview = { ...missedFact, isReview: true }
  assert.deepEqual(scheduleReview(initialQueue, alreadyReview), initialQueue)
})

test('domínio exige dois acertos independentes e nunca conta resposta com pista', () => {
  const assisted = updateFactProgress(undefined, { correct: true, assisted: true })
  assert.equal(assisted.mastered, false)
  assert.equal(assisted.needsReview, true)
  assert.equal(assisted.independentCorrect, 0)

  const firstIndependent = updateFactProgress(assisted, { correct: true, assisted: false })
  assert.equal(firstIndependent.mastered, false)
  assert.equal(firstIndependent.independentCorrect, 1)

  const secondIndependent = updateFactProgress(firstIndependent, { correct: true, assisted: false })
  assert.equal(secondIndependent.mastered, true)
  assert.equal(secondIndependent.needsReview, false)
  assert.equal(secondIndependent.independentCorrect, 2)

  const missed = updateFactProgress(secondIndependent, { correct: false, assisted: false })
  assert.equal(missed.mastered, false)
  assert.equal(missed.needsReview, true)
  assert.equal(missed.independentCorrect, 0)
})

test('sessão mista prioriza revisões, depois contas ainda não dominadas', () => {
  const reviewKeys = [factKey(ALL_FACTS[70])]
  const learningKeys = ALL_FACTS.slice(40, 50).map(factKey)
  const session = createMixedSession(reviewKeys, stableRandom, learningKeys)

  assert.equal(factKey(session[0]), reviewKeys[0])
  assert.equal(session[0].isReview, true)
  assert.ok(session.slice(1).every(fact => learningKeys.includes(factKey(fact))))
})
