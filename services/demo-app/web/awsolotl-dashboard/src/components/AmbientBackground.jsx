import { useState } from 'react'
import FluidRipple from './FluidRipple'

// The reference site's texture: a soft warm wash, a faint row of stone-arch
// silhouettes along the bottom, and a handful of small translucent petal
// shapes drifting very slowly. All CSS/SVG, kept deliberately faint --
// atmosphere, not decoration.
function makePetals(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 100),
    size: 10 + Math.round(Math.random() * 16),
    duration: 20 + Math.random() * 16,
    delay: -Math.random() * 26,
    drift: Math.round((Math.random() - 0.5) * 100),
    spin: Math.round(60 + Math.random() * 180),
  }))
}

function usePetals(count) {
  const [petals] = useState(() => makePetals(count))
  return petals
}

function Arches() {
  const arch = (x) => (
    <path
      key={x}
      d={`M${x},130 L${x},70 A34,34 0 0 1 ${x + 68},70 L${x + 68},130`}
      fill="none"
      stroke="rgba(20,18,14,0.55)"
      strokeWidth="1"
    />
  )
  const xs = Array.from({ length: 16 }, (_, i) => i * 84 - 60)
  return (
    <svg className="arches" viewBox="0 0 1200 130" preserveAspectRatio="xMidYMax slice">
      {xs.map(arch)}
    </svg>
  )
}

export default function AmbientBackground() {
  const petals = usePetals(10)

  return (
    <div className="gallery-bg">
      <FluidRipple />
      <Arches />
      {petals.map((p) => (
        <span
          key={p.id}
          className="petal"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.8,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
