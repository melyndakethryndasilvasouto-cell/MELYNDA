import { ReactNode } from 'react'
import Header from './Header'
import ParticleBackground from '../shared/ParticleBackground'
import FaithMissionBanner from '../shared/FaithMissionBanner'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Header />
      <main className="relative pt-16 pb-10 px-4 max-w-xl mx-auto" style={{ zIndex: 1 }}>
        <FaithMissionBanner />
        {children}
      </main>
    </div>
  )
}
