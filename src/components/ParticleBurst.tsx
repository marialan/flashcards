import { useEffect, useState } from 'react'

interface ParticleBurstProps {
  x: number
  y: number
  onComplete?: () => void
}

interface Particle {
  id: number
  type: 'star' | 'sparkle'
  angle: number
  distance: number
}

const PARTICLE_COUNT = 12
const PARTICLE_DURATION_MS = 700

function generateParticles(): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2
    const distance = 80 + Math.random() * 40
    particles.push({
      id: i,
      type: i % 2 === 0 ? 'star' : 'sparkle',
      angle,
      distance,
    })
  }
  return particles
}

function ParticleBurst({ x, y, onComplete }: ParticleBurstProps) {
  const [particles] = useState(generateParticles())

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, PARTICLE_DURATION_MS)

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <>
      {particles.map((particle) => {
        const tx = Math.cos(particle.angle) * particle.distance
        const ty = Math.sin(particle.angle) * particle.distance
        const emoji = particle.type === 'star' ? '✨' : '⭐'

        return (
          <div
            key={particle.id}
            style={{
              position: 'fixed',
              left: `${x}px`,
              top: `${y}px`,
              pointerEvents: 'none',
              zIndex: 99,
              animation: `particleFloat ${PARTICLE_DURATION_MS}ms ease-out forwards`,
              '--tx': `${tx}px`,
              '--ty': `${ty}px`,
            } as React.CSSProperties}
          >
            {emoji}
          </div>
        )
      })}
    </>
  )
}

export default ParticleBurst
