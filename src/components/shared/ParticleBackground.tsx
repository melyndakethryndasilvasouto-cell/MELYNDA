import { useEffect, useRef } from 'react'

export default function ParticleBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const colors = ['#6BB8FF', '#A78BFA', '#93C5FD', '#C4B5FD', '#BFDBFE', '#DDD6FE']
    const shapes = ['⭐', '✨', '💫', '🌸', '•', '•', '•']
    const particles: HTMLSpanElement[] = []

    for (let i = 0; i < 15; i++) {
      const p = document.createElement('span')
      const isShape = Math.random() > 0.6
      const size = Math.random() * 10 + 5
      const color = colors[Math.floor(Math.random() * colors.length)]
      const dur = 10 + Math.random() * 14
      const delay = Math.random() * 12

      p.style.cssText = `
        position:fixed; pointer-events:none; z-index:0;
        left:${Math.random() * 100}vw; bottom:-30px;
        width:${size}px; height:${size}px;
        ${isShape ? `font-size:${size}px; line-height:1;` : `background:${color}; border-radius:50%;`}
        opacity:0;
        animation: float-particle ${dur}s ${delay}s linear infinite;
      `
      if (isShape) p.textContent = shapes[Math.floor(Math.random() * shapes.length)]
      el.appendChild(p)
      particles.push(p)
    }
    return () => particles.forEach(p => p.remove())
  }, [])

  return <div ref={ref} className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} />
}
