import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import { useSound } from '../../contexts/SoundContext'
import { cleanStopAnswers, STOP_CATEGORIES, validStopAnswer } from '../../online/newGameRules.mjs'
import { chooseAdedonhaLetter, scoreLocalAdedonhaRound } from '../../online/localGameAi.mjs'

type Difficulty = 'easy' | 'medium' | 'hard'
type Answers = Record<string, string>
type ResultRow = {
  key: string
  label: string
  hostAnswer: string
  guestAnswer: string
  hostScore: number
  guestScore: number
}
type RoundResult = { rows: ResultRow[]; hostScore: number; guestScore: number; systemAnswers: Answers }

const LEVELS: { key: Difficulty; label: string; helper: string }[] = [
  { key: 'easy', label: 'Fácil (baixo)', helper: 'O sistema responde 4 categorias e usa letras mais conhecidas.' },
  { key: 'medium', label: 'Médio', helper: 'O sistema responde 6 categorias e recebe mais letras.' },
  { key: 'hard', label: 'Difícil (alto)', helper: 'O sistema responde todas as 8 categorias e usa todas as letras.' },
]

const emptyAnswers = (): Answers => Object.fromEntries(STOP_CATEGORIES.map(({ key }) => [key, '']))

export default function Adedonha() {
  const { playSound } = useSound()
  const { playerName, updateScore } = usePlayer()
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [letter, setLetter] = useState(() => chooseAdedonhaLetter('easy'))
  const [answers, setAnswers] = useState<Answers>(() => emptyAnswers())
  const [result, setResult] = useState<RoundResult | null>(null)
  const [rounds, setRounds] = useState({ player: 0, system: 0, draws: 0 })
  const hasAnswer = useMemo(() => Object.values(answers).some(answer => answer.trim().length >= 2), [answers])
  const resultStatusRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (result) resultStatusRef.current?.focus()
  }, [result])

  const beginRound = (nextDifficulty = difficulty, resetScore = false) => {
    setDifficulty(nextDifficulty)
    setLetter(chooseAdedonhaLetter(nextDifficulty))
    setAnswers(emptyAnswers())
    setResult(null)
    if (resetScore) setRounds({ player: 0, system: 0, draws: 0 })
    window.requestAnimationFrame(() => firstInputRef.current?.focus())
  }

  const changeDifficulty = (nextDifficulty: Difficulty) => {
    if (nextDifficulty === difficulty) return
    playSound('click')
    beginRound(nextDifficulty, true)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (result || !hasAnswer) return
    const cleaned = cleanStopAnswers(answers)
    const scored = scoreLocalAdedonhaRound(letter, cleaned, difficulty) as RoundResult
    const winner = scored.hostScore > scored.guestScore ? 'player' : scored.guestScore > scored.hostScore ? 'system' : 'draws'
    const nextRounds = { ...rounds, [winner]: rounds[winner] + 1 }
    setAnswers(cleaned)
    setResult(scored)
    setRounds(nextRounds)

    if (winner === 'player') {
      playSound('win')
      updateScore('Adedonha', scored.hostScore)
    } else if (winner === 'system') playSound('lose')
    else playSound('click')
  }

  const resultMessage = !result ? ''
    : result.hostScore > result.guestScore ? '🏆 Você venceu a rodada! Muito bem!'
      : result.guestScore > result.hostScore ? '🌱 O sistema venceu. Veja as respostas e aprenda palavras novas!'
        : '🤝 Empate! Vocês fizeram a mesma quantidade de pontos.'

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col gap-5 px-3 py-6 sm:px-5" aria-labelledby="adedonha-local-title">
      <header className="text-center">
        <p className="text-6xl" aria-hidden="true">📝</p>
        <h1 id="adedonha-local-title" className="mt-2 font-title text-3xl sm:text-4xl" style={{ color: '#5B3A8A' }}>Adedonha</h1>
        <p className="mt-2 font-bold text-slate-700">Pense em palavras e jogue contra o sistema</p>
      </header>

      <fieldset className="glass-card w-full p-4" aria-describedby="adedonha-level-help">
        <legend className="px-2 text-center font-black" style={{ color: '#5B3A8A' }}>Escolha a dificuldade</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {LEVELS.map(level => (
            <button
              key={level.key}
              type="button"
              aria-pressed={difficulty === level.key}
              className={`min-h-14 rounded-2xl border-2 px-3 py-2 text-sm font-black transition-colors ${difficulty === level.key ? 'border-purple-700 bg-purple-700 text-white' : 'border-purple-200 bg-white text-purple-900'}`}
              onClick={() => changeDifficulty(level.key)}
            >
              {level.label}
            </button>
          ))}
        </div>
        <p id="adedonha-level-help" className="mt-2 text-center text-sm font-bold text-slate-700">
          {LEVELS.find(level => level.key === difficulty)?.helper} Trocar o nível zera o placar de rodadas.
        </p>
      </fieldset>

      <div className="glass-card grid w-full grid-cols-3 gap-2 p-4 text-center" aria-label="Placar de rodadas">
        <div><span className="block text-xs font-bold text-slate-600">{playerName || 'Você'}</span><strong className="text-3xl text-blue-700">{rounds.player}</strong></div>
        <div><span className="block text-xs font-bold text-slate-600">Empates</span><strong className="text-3xl text-slate-700">{rounds.draws}</strong></div>
        <div><span className="block text-xs font-bold text-slate-600">Sistema</span><strong className="text-3xl text-purple-700">{rounds.system}</strong></div>
      </div>

      <div className="text-center">
        <p className="font-bold text-slate-700">Todas as respostas começam com</p>
        <p className="mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-full bg-yellow-300 font-title text-6xl text-purple-950 shadow-md" aria-label={`Letra sorteada: ${letter}`}>{letter}</p>
      </div>

      {!result ? (
        <form className="glass-card grid gap-4 p-4 sm:grid-cols-2 sm:p-6" onSubmit={submit} noValidate>
          {STOP_CATEGORIES.map(category => {
            const inputId = `adedonha-${category.key}`
            const hintId = `${inputId}-hint`
            return (
              <label key={category.key} htmlFor={inputId} className="text-sm font-black text-slate-800">
                {category.label}
                <input
                  id={inputId}
                  ref={category.key === STOP_CATEGORIES[0].key ? firstInputRef : undefined}
                  value={answers[category.key]}
                  maxLength={24}
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck="true"
                  aria-describedby={hintId}
                  onChange={event => setAnswers(previous => ({ ...previous, [category.key]: event.target.value }))}
                  className="mt-1 min-h-12 w-full rounded-xl border-2 border-purple-200 bg-white px-3 font-bold focus:border-blue-600 focus:outline-none"
                  placeholder={`${letter}...`}
                />
                <span id={hintId} className="mt-1 block text-xs font-semibold text-slate-600">{category.hint}</span>
              </label>
            )
          })}
          <button type="submit" className="btn-primary mt-1 w-full sm:col-span-2" disabled={!hasAnswer}>ADEDONHA! Conferir respostas</button>
          <p className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-center text-xs font-bold text-amber-950">
            🔒 Esta partida é local: nada é enviado ou salvo. Não escreva nome completo, escola, endereço ou onde você mora.
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <div ref={resultStatusRef} tabIndex={-1} className="rounded-2xl bg-blue-50 p-4 text-center text-lg font-black text-blue-950" role="status" aria-live="polite">
            {resultMessage}<span className="mt-1 block text-base">Você {result.hostScore} × {result.guestScore} Sistema</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Comparação das respostas">
            {result.rows.map(row => {
              const playerValid = validStopAnswer(row.hostAnswer, letter)
              return (
                <article key={row.key} className="glass-card p-4">
                  <h2 className="font-title text-lg" style={{ color: '#5B3A8A' }}>{row.label}</h2>
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
                    <dt className="font-bold text-slate-700">Você: <span className="break-words text-slate-950">{row.hostAnswer || 'Sem resposta'}</span></dt>
                    <dd className="font-black text-blue-700">{row.hostScore} pts</dd>
                    <dt className="font-bold text-slate-700">Sistema: <span className="break-words text-slate-950">{row.guestAnswer || 'Sem resposta'}</span></dt>
                    <dd className="font-black text-purple-700">{row.guestScore} pts</dd>
                  </dl>
                  {!playerValid && row.hostAnswer && <p className="mt-2 text-xs font-bold text-red-800">A resposta precisa começar com {letter} e usar somente letras, espaços, hífen ou apóstrofo.</p>}
                </article>
              )
            })}
          </div>
          <p className="rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-950">Resposta válida vale 10 pontos; se for igual à do sistema, cada um recebe 5.</p>
          <button type="button" className="btn-primary w-full" onClick={() => { playSound('click'); beginRound() }}>Sortear outra letra</button>
        </div>
      )}

      <aside className="w-full rounded-2xl bg-green-50 p-3 text-center text-sm font-bold text-green-950">
        Aprender palavras também é crescer em sabedoria. <span className="verse-chip">Provérbios 2:6</span>
      </aside>
    </section>
  )
}
