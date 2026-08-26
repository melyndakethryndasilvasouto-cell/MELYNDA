import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Volume2, VolumeX, Star } from 'lucide-react'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isMuted, toggleMute } = useSound()
  const { playerName, playerAvatar } = usePlayer()
  const isHome = location.pathname === '/'

  return (
    <header className="fixed top-0 left-0 right-0 z-50"
      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 2px 12px rgba(107,184,255,0.1)' }}>
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isHome ? (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 rounded-2xl font-bold text-sm active:scale-90 transition-transform"
              style={{ background: 'rgba(107,184,255,0.15)', color: '#4A90D9' }}
            >
              <ArrowLeft size={18} />
              Menu
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-float" aria-hidden="true">📖</span>
              <span className="font-title text-lg" style={{ color: '#7B5EA7' }}>Bíblia da Mel</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isHome && playerName && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-2xl text-sm font-bold"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#7B5EA7' }}>
              <Star size={13} fill="#F59E0B" stroke="#F59E0B" />
              <span aria-hidden="true">{playerAvatar}</span>
              {playerName}
            </div>
          )}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Ativar sons' : 'Silenciar sons'}
            className="p-2 rounded-2xl active:scale-90 transition-transform"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#7B5EA7' }}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>
    </header>
  )
}
