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
      <Header />
      <OnlineNotifications />
      <main className={`relative mx-auto px-4 pb-10 pt-20 ${widePage ? 'max-w-4xl' : 'max-w-xl'}`} style={{ zIndex: 1 }}>
        <FaithMissionBanner />
        {children}
      </main>
    </div>
  )
}
