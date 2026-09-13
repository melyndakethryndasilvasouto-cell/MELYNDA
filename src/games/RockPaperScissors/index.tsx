import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePlayer } from '../../contexts/PlayerContext'
import { useSound } from '../../contexts/SoundContext'
import { chooseRpsAiChoice, resolveLocalRpsRound } from '../../online/localGameAi.mjs'

type Difficulty = 'easy' | 'medium' | 'hard'
type Choice = 'rock' | 'paper' | 'scissors'
type RoundWinner = 'player' | 'system' | 'draw'

const CHOICES: { key: Choice; emoji: string; label: string; beats: string }[] = [
  { key: 'rock', emoji: '✊', label: 'Pedra', beats: 'quebra a tesoura' },
  { key: 'paper', emoji: '✋', label: 'Papel', beats: 'embrulha a pedra' },
  { key: 'scissors', emoji: '✌️', label: 'Tesoura', beats: 'corta o papel' },
]

const LEVELS: { key: Difficulty; label: string; helper: string }[] = [
  { key: 'easy', label: 'Fácil', helper: 'A máquina ajuda você a aprender.' },
  { key: 'medium', label: 'Médio', helper: 'A máquina observa seus costumes.' },
  { key: 'hard', label: 'Difícil', helper: 'A máquina procura prever sua estratégia.' },
]

const choiceDetails = (choice: Choice | null) => CHOICES.find(item => item.key === choice)

export default function RockPaperScissors() {
  const { playSound } = useSound()
  const { playerName, updateScore } = usePlayer()
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [history, setHistory] = useState<Choice[]>([])
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null)
  const [systemChoice, setSystemChoice] = useState<Choice | null>(null)
  const [roundWinner, setRoundWinner] = useState<RoundWinner | null>(null)
  const [scores, setScores] = useState({ player: 0, system: 0, draws: 0 })
  const matchWinner = scores.player >= 3 ? 'player' : scores.system >= 3 ? 'system' : null

  const resetMatch = (nextDifficulty = difficulty) => {
    setDifficulty(nextDifficulty)
    setHistory([])
    setPlayerChoice(null)
    setSystemChoice(null)
    setRoundWinner(null)
    setScores({ player: 0, system: 0, draws: 0 })
  }

  const changeDifficulty = (nextDifficulty: Difficulty) => {
    if (nextDifficulty === difficulty) return
    playSound('click')
    resetMatch(nextDifficulty)
  }

  const choose = (choice: Choice) => {
    if (matchWinner) return
    const machineChoice = chooseRpsAiChoice(difficulty, history) as Choice
    const winner = resolveLocalRpsRound(choice, machineChoice) as RoundWinner
    const nextScores = {
      player: scores.player + (winner === 'player' ? 1 : 0),
      system: scores.system + (winner === 'system' ? 1 : 0),
      draws: scores.draws + (winner === 'draw' ? 1 : 0),
    }

    setPlayerChoice(choice)
    setSystemChoice(machineChoice)
    setRoundWinner(winner)
    setHistory(previous => [...previous, choice].slice(-30))
    setScores(nextScores)

    if (nextScores.player >= 3) {
      playSound('win')
      updateScore('RockPaperScissors', nextScores.player)
    } else if (nextScores.system >= 3) playSound('lose')
    else playSound(winner === 'player' ? 'match' : winner === 'system' ? 'error' : 'click')
  }

  const roundMessage = !roundWinner
    ? 'Escolha sua jogada. A máquina decide sem ver sua escolha atual.'
    : roundWinner === 'draw'
      ? 'Empate! Os dois escolheram o mesmo símbolo.'
      : roundWinner === 'player'
        ? `${choiceDetails(playerChoice)?.label} ${choiceDetails(playerChoice)?.beats}. Você marcou!`
        : `${choiceDetails(systemChoice)?.label} ${choiceDetails(systemChoice)?.beats}. A máquina marcou.`

  return (
    <section className="game-area mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center gap-5 px-3 py-6 sm:px-5" aria-labelledby="rps-local-title">
      <header className="text-center">
        <p className="text-6xl" aria-hidden="true">✊ ✋ ✌️</p>
        <h1 id="rps-local-title" className="mt-2 font-title text-3xl sm:text-4xl" style={{ color: '#5B3A8A' }}>
          Pedra, Papel e Tesoura
        </h1>
        <p className="mt-2 font-bold text-slate-700">Jogue contra a máquina · primeiro a fazer 3 pontos vence</p>
      </header>

      <fieldset className="glass-card w-full p-4" aria-describedby="rps-level-help">
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
        <p id="rps-level-help" className="mt-2 text-center text-sm font-bold text-slate-700">
          {LEVELS.find(level => level.key === difficulty)?.helper} Trocar o nível começa uma partida nova.
        </p>
      </fieldset>

      <div className="glass-card grid w-full grid-cols-3 gap-2 p-4 text-center" aria-label="Placar da partida">
        <div><span className="block text-xs font-bold text-slate-600">{playerName || 'Você'}</span><strong className="text-3xl text-blue-700">{scores.player}</strong></div>
        <div><span className="block text-xs font-bold text-slate-600">Empates</span><strong className="text-3xl text-slate-700">{scores.draws}</strong></div>
        <div><span className="block text-xs font-bold text-slate-600">Máquina</span><strong className="text-3xl text-purple-700">{scores.system}</strong></div>
      </div>

      <p className="min-h-14 w-full rounded-2xl bg-blue-50 p-3 text-center font-bold text-blue-950" role="status" aria-live="polite">
        {matchWinner === 'player' ? '🏆 Parabéns! Você venceu a partida com atenção e perseverança!' : matchWinner === 'system' ? '🌱 A máquina venceu desta vez. Tente outra vez e observe os padrões!' : roundMessage}
      </p>

      {playerChoice && systemChoice && (
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="grid w-full grid-cols-2 gap-3">
          <div className="rounded-3xl bg-blue-50 p-4 text-center">
            <span className="text-6xl" aria-hidden="true">{choiceDetails(playerChoice)?.emoji}</span>
            <p className="mt-2 font-black text-blue-950">Sua escolha: {choiceDetails(playerChoice)?.label}</p>
          </div>
          <div className="rounded-3xl bg-purple-50 p-4 text-center">
            <span className="text-6xl" aria-hidden="true">{choiceDetails(systemChoice)?.emoji}</span>
            <p className="mt-2 font-black text-purple-950">Máquina: {choiceDetails(systemChoice)?.label}</p>
          </div>
        </motion.div>
      )}

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Escolha uma jogada">
        {CHOICES.map(choice => (
          <motion.button
            key={choice.key}
            type="button"
            whileTap={{ scale: 0.94 }}
            disabled={Boolean(matchWinner)}
            onClick={() => choose(choice.key)}
            className="min-h-32 rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-yellow-50 to-orange-100 p-3 font-black text-slate-900 shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Jogar ${choice.label}: ${choice.beats}`}
          >
            <span className="block text-6xl" aria-hidden="true">{choice.emoji}</span>
            <span className="mt-1 block text-lg">{choice.label}</span>
            <span className="block text-xs font-bold text-slate-700">{choice.beats}</span>
          </motion.button>
        ))}
      </div>

      {matchWinner && <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => { playSound('click'); resetMatch() }}>Jogar nova partida</button>}

      <aside className="w-full rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-950">
        Jogue com alegria, honestidade e respeito. <span className="verse-chip">Colossenses 3:23</span>
      </aside>
    </section>
  )
}
