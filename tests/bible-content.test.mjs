import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, root), 'utf8'))
const referencePattern = /^(?:[1-3] )?[A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+)* \d+:\d+/

test('cada jogo possui uma missão bíblica única e completa', async () => {
  const missions = await readJson('src/data/gameMissions.json')
  assert.equal(missions.length, 10)
  assert.equal(new Set(missions.map(({ path }) => path)).size, missions.length)
  assert.equal(new Set(missions.map(({ gameId }) => gameId)).size, missions.length)

  for (const mission of missions) {
    assert.match(mission.path, /^\//)
    assert.match(mission.verseRef, referencePattern)
    assert.ok(mission.homeName.length >= 3)
    assert.ok(mission.message.length >= 20)
    assert.ok(mission.challenge.length >= 20)
  }

  assert.deepEqual(
    Object.fromEntries(missions.map(({ gameId, homeName }) => [gameId, homeName])),
    {
      memoria: 'Memória da Bíblia',
      velha: 'Jogo da Velha',
      dama: 'Dama',
      uno: 'UNO',
      colorir: 'Colorindo a Bíblia',
      cobra: 'Cobrinha',
      simon: 'Sequência de Cores',
      quiz: 'Quiz da Bíblia',
      puzzle: 'Quebra-Cabeça',
      pong: 'Ping Pong',
    },
  )
})

test('quiz bíblico tem banco amplo, respostas válidas e ensino em todas as questões', async () => {
  const questions = await readJson('src/data/quizQuestions.json')
  assert.ok(questions.length >= 48)
  assert.equal(new Set(questions.map(({ question }) => question)).size, questions.length)
  assert.ok(new Set(questions.map(({ category }) => category)).size >= 4)

  for (const item of questions) {
    assert.equal(item.options.length, 4)
    assert.ok(Number.isInteger(item.correct) && item.correct >= 0 && item.correct < item.options.length)
    assert.match(item.verseRef, referencePattern)
    assert.ok(item.explanation.length >= 20)
    assert.ok(item.options[item.correct].length > 0)
  }
})

test('memória bíblica oferece dez pares distintos com referência e mensagem', async () => {
  const pairs = await readJson('src/data/memoryPairs.json')
  assert.equal(pairs.length, 10)
  assert.equal(new Set(pairs.map(({ id }) => id)).size, pairs.length)
  assert.equal(new Set(pairs.map(({ emoji }) => emoji)).size, pairs.length)
  for (const pair of pairs) {
    assert.match(pair.verseRef, referencePattern)
    assert.ok(pair.message.length >= 20)
  }
})

test('colorir possui oito lições bíblicas vinculadas aos desenhos esperados', async () => {
  const lessons = await readJson('src/data/coloringLessons.json')
  assert.deepEqual(
    lessons.map(({ id }) => id),
    ['ark', 'new-life', 'creation', 'bethlehem', 'lamb', 'promise', 'love', 'fortress'],
  )
  for (const lesson of lessons) {
    assert.match(lesson.verseRef, referencePattern)
    assert.ok(lesson.verseText.length >= 20)
  }
})

test('catálogos bíblicos estão conectados às telas que os utilizam', async () => {
  const [app, home, quiz, memory, coloring, layout] = await Promise.all([
    readFile(new URL('src/App.tsx', root), 'utf8'),
    readFile(new URL('src/components/Home/HomePage.tsx', root), 'utf8'),
    readFile(new URL('src/games/Quiz/index.tsx', root), 'utf8'),
    readFile(new URL('src/games/Memory/index.tsx', root), 'utf8'),
    readFile(new URL('src/games/ColorBook/index.tsx', root), 'utf8'),
    readFile(new URL('src/components/Layout/Layout.tsx', root), 'utf8'),
  ])
  const missions = await readJson('src/data/gameMissions.json')

  for (const { path } of missions) assert.ok(app.includes(`path="${path}"`), `rota ausente: ${path}`)
  assert.match(home, /gameMissions\.json/)
  assert.match(layout, /FaithMissionBanner/)
  assert.match(quiz, /quizQuestions\.json/)
  assert.match(memory, /memoryPairs\.json/)
  assert.match(coloring, /coloringLessons\.json/)
  assert.doesNotMatch(quiz, /Qual animal faz MIA/)
})
