import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'

interface MaiWinnerEffectProps {
  challengerName: string
  onComplete?: () => void
}

const EMOJIS = ['🪙', '🏆', '🎤', '👑', '💸', '🔥', '🎉', '✨', '🌟', '🎊']

interface Particle {
  id: number
  x: number
  y: number
  emoji: string
  size: number
  drift: number
}

export function MaiWinnerEffect({ challengerName, onComplete }: MaiWinnerEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const list: Particle[] = []
    for (let i = 0; i < 40; i += 1) {
      list.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        size: 16 + Math.random() * 16,
        drift: (Math.random() - 0.5) * 0.6,
      })
    }
    setParticles(list)

    const t = setTimeout(() => {
      onComplete?.()
    }, 2600)
    return () => clearTimeout(t)
  }, [onComplete])

  // falling animation
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes mai-fall {
        0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) translateX(var(--drift)); opacity: 0; }
      }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {particles.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute"
          style={{
            left: `${p.x}vw`,
            top: `${p.y}vh`,
            fontSize: `${p.size}px`,
            '--drift': `${p.drift * 100}px`,
            animation: 'mai-fall 2.8s ease-in forwards',
            animationDelay: `${(p.id % 20) * 0.05}s`,
          } as any}
        >
          {p.emoji}
        </span>
      ))}
      <div className="relative z-10 rounded-xl bg-gradient-to-r from-yellow-300 via-rose-500 to-purple-600 px-8 py-4 text-3xl font-extrabold text-transparent bg-clip-text animate-bounce">
        <span className="flex items-center gap-1 justify-center">
          <Crown className="w-6 h-6 text-yellow-300" /> MAI WINNER
        </span>
        <span className="block text-xl text-white">— {challengerName} —</span>
      </div>
    </div>
  )
}
