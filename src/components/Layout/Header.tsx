import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, BookHeart, Gamepad2, Volume2, VolumeX, Star, Wifi } from 'lucide-react'
import { useSound } from '../../contexts/SoundContext'
import { usePlayer } from '../../contexts/PlayerContext'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isMuted, toggleMute } = useSound()
  const { playerName, playerAvatar } = usePlayer()
  const isHome = location.pathname === '/'
  const isDevotional = location.pathname === '/devocional'
  const isOnline = location.pathname.startsWith('/online')
  const isMainPage = isHome || isDevotional

  return (
    <header className="fixed top-0 left-0 right-0 z-50"
      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 2px 12px rgba(107,184,255,0.1)' }}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {!isMainPage ? (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition-transform active:scale-90"
              style={{ background: 'rgba(107,184,255,0.15)', color: '#4A90D9' }}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Menu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-2xl px-1 text-left transition-transform active:scale-95"
              aria-label="Ir para os jogos da Bíblia da Mel"
            >
              <span className="text-2xl animate-float" aria-hidden="true">📖</span>
              <span className="whitespace-nowrap font-title text-sm sm:text-lg" style={{ color: '#7B5EA7' }}>Bíblia da Mel</span>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => navigate(isDevotional ? '/' : '/devocional')}
            aria-current={isDevotional ? 'page' : undefined}
            aria-label={isDevotional ? 'Voltar aos jogos' : 'Abrir Devocional'}
            className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-2xl px-2.5 text-xs font-black transition-transform active:scale-90 sm:px-3 sm:text-sm"
            style={{
              background: isDevotional ? 'linear-gradient(135deg,#6BB8FF,#A78BFA)' : 'rgba(107,184,255,0.15)',
              color: isDevotional ? '#FFFFFF' : '#5B3A8A',
            }}
          >
            {isDevotional ? <Gamepad2 size={17} aria-hidden="true" /> : <BookHeart size={17} aria-hidden="true" />}
            <span className="hidden sm:inline">{isDevotional ? 'Jogos' : 'Devocional'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(isOnline ? '/' : '/online')}
            aria-current={isOnline ? 'page' : undefined}
            aria-label={isOnline ? 'Voltar aos jogos' : 'Abrir jogadores online'}
            className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-2xl px-2.5 text-xs font-black transition-transform active:scale-90 sm:px-3 sm:text-sm"
            style={{
              background: isOnline ? 'linear-gradient(135deg,#34D399,#4A90D9)' : 'rgba(52,211,153,0.14)',
              color: isOnline ? '#FFFFFF' : '#166534',
            }}
          >
            {isOnline ? <Gamepad2 size={17} aria-hidden="true" /> : <Wifi size={17} aria-hidden="true" />}
            <span className="hidden sm:inline">{isOnline ? 'Jogos' : 'Online'}</span>
          </button>
          {isMainPage && playerName && (
            <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-2xl text-sm font-bold"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#7B5EA7' }}>
              <Star size={13} fill="#F59E0B" stroke="#F59E0B" aria-hidden="true" />
              <span aria-hidden="true">{playerAvatar}</span>
              {playerName}
            </div>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Ativar sons' : 'Silenciar sons'}
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform active:scale-90"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#7B5EA7' }}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>
    </header>
  )
}
