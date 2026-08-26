import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type SoundType = 'click' | 'win' | 'lose' | 'match' | 'card' | 'error' | 'flip' | 'tick'

interface SoundContextType {
  isMuted: boolean
  toggleMute: () => void
  playSound: (type: SoundType) => void
}

const SoundContext = createContext<SoundContextType | null>(null)

let _audioCtx: AudioContext | null = null
function getCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return _audioCtx
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur)
  } catch {}
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('mel-muted') === 'true')

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      localStorage.setItem('mel-muted', String(next))
      return next
    })
  }, [])

  const playSound = useCallback((type: SoundType) => {
    if (isMuted) return
    switch (type) {
      case 'click':  tone(700, 0.08, 'sine', 0.18); break
      case 'flip':   tone(450, 0.12, 'triangle', 0.2); break
      case 'card':   tone(400, 0.1, 'triangle', 0.2); break
      case 'match':  tone(600, 0.12); setTimeout(() => tone(800, 0.15), 120); break
      case 'error':  tone(280, 0.22, 'sawtooth', 0.18); break
      case 'lose':   tone(300, 0.15); setTimeout(() => tone(250, 0.25, 'sawtooth'), 160); break
      case 'tick':   tone(1000, 0.05, 'square', 0.1); break
      case 'win':
        tone(523, 0.18); setTimeout(() => tone(659, 0.18), 180)
        setTimeout(() => tone(784, 0.18), 360); setTimeout(() => tone(1046, 0.3), 540)
        break
    }
  }, [isMuted])

  return (
    <SoundContext.Provider value={{ isMuted, toggleMute, playSound }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound must be used within SoundProvider')
  return ctx
}
