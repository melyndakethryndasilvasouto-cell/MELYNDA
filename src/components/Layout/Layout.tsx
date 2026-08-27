import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import ParticleBackground from '../shared/ParticleBackground'
import FaithMissionBanner from '../shared/FaithMissionBanner'
import OnlineNotifications from '../Online/OnlineNotifications'

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const widePage = pathname.startsWith('/devocional') || pathname.startsWith('/online')
  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[120] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-black focus:text-blue-900 focus:shadow-xl">Pular para o conteúdo</a>
      <Header />
      <OnlineNotifications />
      <main id="main-content" tabIndex={-1} className={`relative mx-auto px-4 pb-10 pt-20 ${widePage ? 'max-w-4xl' : 'max-w-xl'}`} style={{ zIndex: 1 }}>
        <FaithMissionBanner />
        {children}
      </main>
    </div>
  )
}
