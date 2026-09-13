import {
  RPS_CHOICES,
  STOP_CATEGORIES,
  STOP_LETTERS,
  cleanStopAnswers,
  rpsRoundWinner,
  scoreStopRound,
  validStopAnswer,
} from './newGameRules.mjs'

export const LOCAL_DIFFICULTIES = ['easy', 'medium', 'hard']

const RPS_COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' }
const RPS_LOSING_CHOICE = { rock: 'scissors', paper: 'rock', scissors: 'paper' }

function safeDifficulty(value) {
  return LOCAL_DIFFICULTIES.includes(value) ? value : 'easy'
}

function safeRandom(random) {
  const value = Number(random())
  return Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0
}

function randomItem(items, random) {
  return items[Math.floor(safeRandom(random) * items.length)]
}

function validRpsHistory(history) {
  return Array.isArray(history) ? history.filter(choice => RPS_CHOICES.includes(choice)).slice(-30) : []
}

function mostFrequentChoice(choices) {
  const totals = Object.fromEntries(RPS_CHOICES.map(choice => [choice, 0]))
  for (const choice of choices) totals[choice] += 1
  return RPS_CHOICES.reduce((best, choice) => totals[choice] > totals[best] ? choice : best, RPS_CHOICES[0])
}

function predictNextChoice(history) {
  const last = history.at(-1)
  if (!last) return RPS_CHOICES[0]
  const following = []
  for (let index = 0; index < history.length - 1; index += 1) {
    if (history[index] === last) following.push(history[index + 1])
  }
  return mostFrequentChoice(following.length ? following : history)
}

/**
 * Escolhe antes da jogada atual da criança. A IA nunca recebe nem enxerga a
 * escolha da rodada em andamento; usa somente o histórico já revelado.
 */
export function chooseRpsAiChoice(difficulty, playerHistory = [], random = Math.random) {
  const level = safeDifficulty(difficulty)
  const history = validRpsHistory(playerHistory)
  if (!history.length) return randomItem(RPS_CHOICES, random)

  if (level === 'easy') {
    return safeRandom(random) < 0.65
      ? RPS_LOSING_CHOICE[history.at(-1)]
      : randomItem(RPS_CHOICES, random)
  }

  const prediction = level === 'hard' ? predictNextChoice(history) : mostFrequentChoice(history)
  const confidence = level === 'hard' ? 0.88 : 0.58
  return safeRandom(random) < confidence
    ? RPS_COUNTER[prediction]
    : randomItem(RPS_CHOICES, random)
}

export function resolveLocalRpsRound(playerChoice, systemChoice) {
  const winner = rpsRoundWinner(playerChoice, systemChoice)
  if (winner === 'host') return 'player'
  if (winner === 'guest') return 'system'
  return winner
}

const ANSWER_ROWS = {
  A: ['Ana', 'Arara', 'Arroz', 'Argentina', 'Aracaju', 'Acre', 'Agulha', 'Abraão'],
  B: ['Bruno', 'Baleia', 'Bolo', 'Brasil', 'Brasília', 'Bahia', 'Bola', 'Belém'],
  C: ['Clara', 'Cavalo', 'Cuscuz', 'Canadá', 'Curitiba', 'Ceará', 'Caderno', 'Canaã'],
  D: ['Daniel', 'Dromedário', 'Doce', 'Dinamarca', 'Dourados', 'Distrito Federal', 'Dado', 'Davi'],
  E: ['Ester', 'Elefante', 'Empada', 'Espanha', 'Esteio', 'Espírito Santo', 'Escova', 'Êxodo'],
  F: ['Felipe', 'Foca', 'Feijão', 'França', 'Fortaleza', 'Flórida', 'Faca', 'Filemom'],
  G: ['Gabriel', 'Girafa', 'Goiaba', 'Gana', 'Goiânia', 'Goiás', 'Garrafa', 'Gênesis'],
  I: ['Isaque', 'Iguana', 'Inhame', 'Índia', 'Itu', 'Illinois', 'Ímã', 'Isaías'],
  J: ['Joana', 'Jacaré', 'Jiló', 'Japão', 'Joinville', 'Jalisco', 'Janela', 'Jeremias'],
  L: ['Lucas', 'Leão', 'Lasanha', 'Líbano', 'Londrina', 'Louisiana', 'Lápis', 'Levítico'],
  M: ['Maria', 'Macaco', 'Macarrão', 'México', 'Manaus', 'Minas Gerais', 'Mesa', 'Mateus'],
  N: ['Noemi', 'Narval', 'Nhoque', 'Noruega', 'Natal', 'Nevada', 'Navio', 'Neemias'],
  O: ['Otávio', 'Onça', 'Omelete', 'Omã', 'Osasco', 'Ohio', 'Óculos', 'Oseias'],
  P: ['Paulo', 'Pato', 'Pão', 'Peru', 'Palmas', 'Paraná', 'Prato', 'Pedro'],
  R: ['Raquel', 'Raposa', 'Risoto', 'Rússia', 'Recife', 'Roraima', 'Relógio', 'Romanos'],
  S: ['Samuel', 'Sapo', 'Sopa', 'Suécia', 'Salvador', 'Sergipe', 'Sapato', 'Salmos'],
  T: ['Tiago', 'Tatu', 'Tapioca', 'Tailândia', 'Teresina', 'Tocantins', 'Tesoura', 'Timóteo'],
  V: ['Vitória', 'Vaca', 'Vatapá', 'Venezuela', 'Vitória', 'Victoria', 'Vaso', 'Vasti'],
}

export const ADEDONHA_ANSWER_BANK = Object.freeze(Object.fromEntries(
  Object.entries(ANSWER_ROWS).map(([letter, values]) => [
    letter,
    Object.freeze(Object.fromEntries(STOP_CATEGORIES.map((category, index) => [category.key, values[index]]))),
  ]),
))

const LETTERS_BY_DIFFICULTY = {
  easy: ['A', 'B', 'C', 'M', 'P', 'S'],
  medium: ['A', 'B', 'C', 'D', 'E', 'G', 'J', 'M', 'P', 'R', 'S', 'T'],
  hard: STOP_LETTERS,
}

const CATEGORIES_BY_DIFFICULTY = {
  easy: ['name', 'animal', 'food', 'bible'],
  medium: ['name', 'animal', 'food', 'city', 'object', 'bible'],
  hard: STOP_CATEGORIES.map(category => category.key),
}

export function chooseAdedonhaLetter(difficulty, random = Math.random) {
  return randomItem(LETTERS_BY_DIFFICULTY[safeDifficulty(difficulty)], random)
}

export function createAdedonhaAiAnswers(letter, difficulty) {
  const normalizedLetter = String(letter ?? '').trim().toLocaleUpperCase('pt-BR')
  const source = ADEDONHA_ANSWER_BANK[normalizedLetter]
  const allowed = new Set(CATEGORIES_BY_DIFFICULTY[safeDifficulty(difficulty)])
  const answers = Object.fromEntries(STOP_CATEGORIES.map(({ key }) => [key, allowed.has(key) ? source?.[key] ?? '' : '']))
  return cleanStopAnswers(answers)
}

export function scoreLocalAdedonhaRound(letter, playerAnswers, difficulty) {
  const systemAnswers = createAdedonhaAiAnswers(letter, difficulty)
  return { systemAnswers, ...scoreStopRound(letter, playerAnswers, systemAnswers) }
}

export function validateAdedonhaAnswerBank() {
  return STOP_LETTERS.every(letter => STOP_CATEGORIES.every(({ key }) => validStopAnswer(ADEDONHA_ANSWER_BANK[letter]?.[key], letter)))
}
