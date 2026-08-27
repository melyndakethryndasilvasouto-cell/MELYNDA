import { useState } from 'react'
import { motion } from 'framer-motion'
import { isSafeName } from '../utils/safety'

interface Props { onComplete: (name: string, avatar: string) => void }

const avatars = [
  { icon: '⭐', label: 'Estrela de Belém' },
  { icon: '🕊️', label: 'Pomba da paz' },
  { icon: '🐑', label: 'Ovelhinha' },
  { icon: '🌈', label: 'Arco da promessa' },
  { icon: '🦁', label: 'Leão de Daniel' },
  { icon: '🐟', label: 'Peixinho' },
  { icon: '📖', label: 'Bíblia' },
  { icon: '🌿', label: 'Ramo verde' },
]

const nicknameIdeas = ['Estrelinha', 'Ovelhinha Feliz', 'Leão Corajoso', 'Peixinho Azul', 'Pomba da Paz']

function cleanNickname(value: string) {
  return value.replace(/[^\p{L}\p{M} -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16)
}

export default function PlayerSetup({ onComplete }: Props) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('⭐')
  const [step, setStep] = useState<'name' | 'avatar'>('name')

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nickname = cleanNickname(name)
    if (nickname.length >= 2) {
      if (!isSafeName(nickname)) {
        alert('Esse apelido não é permitido. Escolha outro mais legal!');
        return;
      }
      setName(nickname)
      setStep('avatar')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #EEF6FF 0%, #F3EEFF 50%, #EEF6FF 100%)' }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="glass-card p-8 w-full max-w-sm text-center"
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="text-6xl mb-3"
        >
          ⭐
        </motion.div>
        <h1 className="font-title text-3xl mb-1" style={{ color: '#7B5EA7' }}>Aventuras da Bíblia</h1>
        <p className="text-sm font-bold mb-6" style={{ color: '#4A90D9' }}>com a Mel 📖</p>

        {step === 'name' ? (
          <motion.form key="name" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleNameSubmit} className="space-y-4">
            <label htmlFor="player-name" className="block font-bold" style={{ color: '#7B5EA7' }}>Escolha um apelido divertido 😊</label>
            <p className="rounded-2xl bg-blue-50 p-3 text-xs font-bold" style={{ color: '#1D4E89' }}>Não escreva nome completo, escola, telefone ou endereço.</p>
            <input
              id="player-name"
              type="text"
              value={name}
              onChange={e => setName(cleanNickname(e.target.value))}
              placeholder="Ex.: Estrelinha"
              maxLength={16}
              autoFocus
              className="w-full px-4 py-3 rounded-2xl text-center text-xl font-bold outline-none"
              style={{ border: '2px solid #C4B5FD', color: '#7B5EA7', background: 'white' }}
            />
            <div className="flex flex-wrap justify-center gap-2" aria-label="Ideias de apelido">
              {nicknameIdeas.slice(0, 3).map(idea => <button key={idea} type="button" onClick={() => setName(idea)} className="min-h-11 rounded-2xl bg-purple-50 px-3 text-xs font-black" style={{ color: '#5B3A8A' }}>{idea}</button>)}
            </div>
            <button type="submit" disabled={cleanNickname(name).length < 2} className="btn-primary w-full disabled:opacity-40">
              Próximo ➡️
            </button>
          </motion.form>
        ) : (
          <motion.div key="avatar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <p className="font-bold" style={{ color: '#7B5EA7' }}>Escolha seu avatar! 🎨</p>
            <div className="grid grid-cols-4 gap-3">
              {avatars.map(({ icon, label }) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setAvatar(icon)}
                  aria-label={label}
                  aria-pressed={avatar === icon}
                  className="text-3xl p-2 rounded-2xl transition-all active:scale-90"
                  style={{
                    background: avatar === icon ? 'linear-gradient(135deg,#6BB8FF,#A78BFA)' : 'rgba(167,139,250,0.1)',
                    transform: avatar === icon ? 'scale(1.1)' : 'scale(1)',
                    border: avatar === icon ? '2px solid #A78BFA' : '2px solid transparent',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
            <button onClick={() => onComplete(name.trim(), avatar)} className="btn-primary w-full">
              {avatar} Começar a jornada!
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
