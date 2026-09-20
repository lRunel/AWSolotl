import { useEffect, useState } from 'react'

// The opening sequence from docs/UI_UX_DESIGN_DOC.md section 4: a line
// draws across the screen connecting hash-chain nodes, blooms, then the UI
// settles in. ~1.2s total, done once per session.
const NODES = [40, 160, 280, 400, 520]

export default function StartupOverlay({ onComplete }) {
  const [phase, setPhase] = useState('draw')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('bloom'), 650)
    const t2 = setTimeout(() => setPhase('reveal'), 950)
    const t3 = setTimeout(onComplete, 1300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  return (
    <div style={{ ...styles.overlay, opacity: phase === 'reveal' ? 0 : 1 }}>
      <svg width="560" height="40" viewBox="0 0 560 40" style={styles.svg}>
        <line
          x1="40" y1="20" x2="520" y2="20"
          stroke="var(--accent)" strokeWidth="1"
          style={{
            strokeDasharray: 480,
            strokeDashoffset: phase === 'draw' ? 480 : 0,
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)',
            opacity: phase === 'bloom' ? 0.25 : 0.9,
          }}
        />
        {NODES.map((x, i) => (
          <circle
            key={x}
            cx={x} cy="20" r={phase === 'draw' ? 0 : 3.5}
            fill={i === NODES.length - 1 ? 'var(--accent)' : 'var(--text-primary)'}
            style={{ transition: `r 0.25s ease ${i * 0.06}s` }}
          />
        ))}
      </svg>
      <div className="mono" style={styles.label}>
        verifying hash chain&hellip;
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    zIndex: 1000,
    transition: 'opacity 0.35s ease',
    pointerEvents: 'none',
  },
  svg: { overflow: 'visible' },
  label: {
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
}
