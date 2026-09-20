import { useEffect, useState } from 'react'

const steps = [
  'Verifying agent integrity...',
  'Loading Cedar policies...',
  'Connecting to ADOT telemetry...',
  'Ready.'
]

export default function StartupOverlay({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(interval)
          setTimeout(onComplete, 600)
          return prev
        }
        return prev + 1
      })
    }, 500)
    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <span style={styles.logo}>🦎</span>
          <h2 style={styles.title}>AWSolotl</h2>
        </div>
        <div style={styles.steps}>
          {steps.map((step, i) => (
            <div key={i} style={{
              ...styles.step,
              opacity: i <= currentStep ? 1 : 0.3,
              transform: i <= currentStep ? 'translateX(0)' : 'translateX(-8px)',
              transition: 'all 0.3s ease',
            }}>
              <span style={{
                ...styles.dot,
                backgroundColor: i < currentStep ? '#5BA4A4'
                  : i === currentStep ? '#E8746A'
                  : '#EDE8E0',
              }} />
              <span style={styles.stepText}>{step}</span>
            </div>
          ))}
        </div>
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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    textAlign: 'center',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 60,
  },
  logo: {
    fontSize: 64,
  },
  title: {
    fontSize: 48,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.04em',
    textTransform: 'uppercase',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'center',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
  },
  stepText: {
    fontSize: 16,
    color: 'var(--text-secondary)',
    fontFamily: "'JetBrains Mono', monospace",
  },
}
