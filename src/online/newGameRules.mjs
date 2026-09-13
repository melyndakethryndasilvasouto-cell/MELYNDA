export const RPS_CHOICES = ['rock', 'paper', 'scissors']

export function rpsRoundWinner(hostChoice, guestChoice) {
  if (!RPS_CHOICES.includes(hostChoice) || !RPS_CHOICES.includes(guestChoice)) return null
  if (hostChoice === guestChoice) return 'draw'
  const hostWins = (hostChoice === 'rock' && guestChoice === 'scissors')
    || (hostChoice === 'paper' && guestChoice === 'rock')
    || (hostChoice === 'scissors' && guestChoice === 'paper')
  return hostWins ? 'host' : 'guest'
}

export const STOP_CATEGORIES = [
  { key: 'name', label: 'Nome', hint: 'Use um nome fictício ou bíblico, nunca seu nome completo.' },
  { key: 'animal', label: 'Animal', hint: 'Ex.: arara, baleia, cavalo.' },
  { key: 'food', label: 'Comida', hint: 'Ex.: arroz, bolo, cenoura.' },
  { key: 'country', label: 'País', hint: 'Vale qualquer país do mundo.' },
  { key: 'city', label: 'Cidade', hint: 'Não precisa ser onde você mora.' },
  { key: 'state', label: 'Estado', hint: 'Não informe onde você mora.' },
  { key: 'object', label: 'Objeto', hint: 'Algo que podemos tocar ou usar.' },
  { key: 'bible', label: 'Bíblia', hint: 'Personagem, livro ou lugar bíblico.' },
]

export const STOP_LETTERS = 'ABCDEFGIJLMNOPRSTV'.split('')

export function normalizeStopWord(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

export function cleanStopAnswers(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return Object.fromEntries(STOP_CATEGORIES.map(({ key }) => [key, String(source[key] ?? '').replace(/\s+/g, ' ').trim().slice(0, 24)]))
}

export function validStopAnswer(value, letter) {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!/^[\p{L}\s'-]{2,24}$/u.test(cleaned)) return false
  return normalizeStopWord(cleaned).startsWith(normalizeStopWord(letter))
}

export function scoreStopRound(letter, hostInput, guestInput) {
  const host = cleanStopAnswers(hostInput)
  const guest = cleanStopAnswers(guestInput)
  const rows = STOP_CATEGORIES.map(({ key, label }) => {
    const hostValid = validStopAnswer(host[key], letter)
    const guestValid = validStopAnswer(guest[key], letter)
    const duplicate = hostValid && guestValid && normalizeStopWord(host[key]) === normalizeStopWord(guest[key])
    return {
      key,
      label,
      hostAnswer: host[key],
      guestAnswer: guest[key],
      hostScore: hostValid ? (duplicate ? 5 : 10) : 0,
      guestScore: guestValid ? (duplicate ? 5 : 10) : 0,
    }
  })
  return {
    rows,
    hostScore: rows.reduce((sum, row) => sum + row.hostScore, 0),
    guestScore: rows.reduce((sum, row) => sum + row.guestScore, 0),
  }
}
