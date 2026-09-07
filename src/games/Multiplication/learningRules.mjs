export const TABLES = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9])
export const MULTIPLIERS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

export const ALL_FACTS = Object.freeze(
  TABLES.flatMap(table => MULTIPLIERS.map(multiplier => Object.freeze({ table, multiplier }))),
)

export function factKey({ table, multiplier }) {
  return `${table}x${multiplier}`
}

function shuffle(items, random = Math.random) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  return shuffled
}

export function createTableSession(table, random = Math.random) {
  if (!TABLES.includes(table)) throw new RangeError('A tabuada deve estar entre 2 e 9.')
  return shuffle(ALL_FACTS.filter(fact => fact.table === table), random)
}

export function createMixedSession(reviewKeys = [], random = Math.random, learningKeys = []) {
  const byKey = new Map(ALL_FACTS.map(fact => [factKey(fact), fact]))
  const reviews = [...new Set(reviewKeys)]
    .map(key => byKey.get(key))
    .filter(Boolean)
    .slice(0, 10)
    .map(fact => ({ ...fact, isReview: true }))
  const reviewSet = new Set(reviews.map(factKey))
  const learning = shuffle([...new Set(learningKeys)]
    .map(key => byKey.get(key))
    .filter(fact => fact && !reviewSet.has(factKey(fact))), random)
  const prioritySet = new Set([...reviews, ...learning].map(factKey))
  const mastered = shuffle(ALL_FACTS.filter(fact => !prioritySet.has(factKey(fact))), random)
  return [...reviews, ...learning, ...mastered].slice(0, 10)
}

export function buildAnswerOptions(fact, random = Math.random) {
  const { table, multiplier } = fact
  const answer = table * multiplier
  const candidates = [
    answer,
    answer - table,
    answer + table,
    answer - multiplier,
    answer + multiplier,
    answer - 1,
    answer + 1,
    table + multiplier,
    table * Math.max(1, multiplier - 2),
  ]
  const unique = [...new Set(candidates.filter(value => Number.isInteger(value) && value > 0))]
  let fallback = 1
  while (unique.length < 4) {
    if (!unique.includes(fallback)) unique.push(fallback)
    fallback += 1
  }
  return shuffle([answer, ...unique.filter(value => value !== answer).slice(0, 3)], random)
}

export function getLesson({ table, multiplier }) {
  const answer = table * multiplier
  const equation = `${table} × ${multiplier} = ${answer}`
  const groups = Array.from({ length: multiplier }, () => table).join(' + ')
  const explanation = `${multiplier} ${multiplier === 1 ? 'grupo' : 'grupos'} de ${table}: ${groups} = ${answer}.`

  let tip
  if (multiplier === 1) {
    tip = `Todo número vezes 1 continua igual: ${table} × 1 = ${table}.`
  } else if (multiplier === 10) {
    tip = `Na vez do 10, coloque um zero depois do ${table}: ${table} × 10 = ${answer}.`
  } else if (table === 2) {
    tip = `A tabuada do 2 é o dobro: ${multiplier} + ${multiplier} = ${answer}.`
  } else if (table === 3) {
    tip = `Faça o dobro e some mais um grupo: ${2 * multiplier} + ${multiplier} = ${answer}.`
  } else if (table === 4) {
    tip = `Dobre duas vezes: o dobro de ${multiplier} é ${2 * multiplier}, e o dobro de ${2 * multiplier} é ${answer}.`
  } else if (table === 5) {
    tip = `Conte de 5 em 5; os resultados sempre terminam em 0 ou 5. Aqui chegamos a ${answer}.`
  } else if (table === 6) {
    tip = `Use 5 grupos e mais 1: ${5 * multiplier} + ${multiplier} = ${answer}.`
  } else if (table === 7) {
    tip = `Junte a tabuada do 5 com a do 2: ${5 * multiplier} + ${2 * multiplier} = ${answer}.`
  } else if (table === 8) {
    tip = `Faça 10 grupos e tire 2: ${10 * multiplier} − ${2 * multiplier} = ${answer}.`
  } else {
    tip = `Faça 10 grupos e tire 1: ${10 * multiplier} − ${multiplier} = ${answer}.`
  }

  return { answer, equation, explanation, tip }
}

export function scheduleReview(queue, fact) {
  if (fact.isReview || queue.some(item => factKey(item) === factKey(fact))) return [...queue]
  const next = [...queue]
  next.splice(Math.min(2, next.length), 0, { ...fact, isReview: true })
  return next
}

export function updateFactProgress(previous = {}, { correct, assisted = false }) {
  const attempts = Math.max(0, Number(previous.attempts) || 0) + 1
  const correctCount = Math.max(0, Number(previous.correct) || 0) + (correct ? 1 : 0)
  const oldIndependent = Math.max(0, Number(previous.independentCorrect) || 0)
  const independentCorrect = correct ? oldIndependent + (assisted ? 0 : 1) : 0
  const mastered = independentCorrect >= 2
  return {
    attempts,
    correct: Math.min(correctCount, attempts),
    independentCorrect,
    mastered,
    needsReview: !mastered,
  }
}
