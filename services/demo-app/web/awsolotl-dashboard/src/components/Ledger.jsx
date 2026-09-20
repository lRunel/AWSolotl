import { useState } from 'react'

const events = [
  {
    id: 1,
    status: 'success',
    badge: 'Executed',
    time: '12:45:02 UTC',
    title: 'Scale ECS Service',
    reasoning: 'ADOT detected CPU spike > 80% on web-api. Scaling desired count from 2 → 4.',
    gates: [
      { name: 'Gate 1 (Purity)', result: 'pass', detail: '' },
      { name: 'Gate 2 (Org Rules)', result: 'pass', detail: 'No violations' },
      { name: 'Gate 3 (Radius)', result: 'pass', detail: '' },
      { name: 'Gate 4 (Autonomy)', result: 'pass', detail: 'Risk: 12 < Cap: 25' },
      { name: 'Gate 5 (Trajectory)', result: 'pass', detail: 'Valid state' },
    ],
    hash: 'SHA256: 8f43b29c941b...',
  },
  {
    id: 2,
    status: 'warning',
    badge: 'Abstained',
    time: '12:30:15 UTC',
    title: 'Revoke Security Group Ingress',
    reasoning: 'Blocked by control plane. Gate 2 evaluated Cedar policy ORG-05 and denied the operation.',
    gates: [
      { name: 'Gate 1 (Purity)', result: 'pass', detail: '' },
      { name: 'Gate 2 (Org Rules)', result: 'fail', detail: '"ORG-05: Never revoke 0.0.0.0/0 on public ALBs."' },
      { name: 'Gate 3 (Radius)', result: 'skip', detail: '' },
      { name: 'Gate 4 (Autonomy)', result: 'skip', detail: '' },
      { name: 'Gate 5 (Trajectory)', result: 'skip', detail: '' },
    ],
    hash: 'SHA256: 3b9a102d5c8e...',
  },
  {
    id: 3,
    status: 'danger',
    badge: 'Blocked',
    time: '11:15:42 UTC',
    title: 'Restart Production Database',
    reasoning: 'Halted by the Trajectory Watchdog. The proposed plan creates an unacceptable availability risk.',
    gates: [
      { name: 'Gate 1 (Purity)', result: 'pass', detail: '' },
      { name: 'Gate 2 (Org Rules)', result: 'pass', detail: '' },
      { name: 'Gate 3 (Radius)', result: 'pass', detail: '' },
      { name: 'Gate 4 (Autonomy)', result: 'pass', detail: '' },
      { name: 'Gate 5 (Trajectory)', result: 'fail', detail: '"SLA Risk: Latency impact > 30s."' },
    ],
    hash: 'SHA256: 9c8b7f1a2ef9...',
  },
]

const statusColors = {
  success: { bg: 'var(--success-light)', color: 'var(--success)', dot: 'var(--success)' },
  warning: { bg: 'var(--warning-light)', color: 'var(--warning)', dot: 'var(--warning)' },
  danger: { bg: 'var(--danger-light)', color: 'var(--danger)', dot: 'var(--danger)' },
}

const resultColors = {
  pass: 'var(--success)',
  fail: 'var(--danger)',
  skip: 'var(--text-muted)',
}

function GateList({ gates, hash }) {
  return (
    <div style={styles.gateList}>
      {gates.map((g, i) => (
        <div key={i} style={styles.gateRow}>
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{g.name}:</span>
          <span style={{ color: resultColors[g.result], fontWeight: 600, textTransform: 'capitalize' }}>
            {g.result === 'skip' ? 'Skipped' : g.result === 'pass' ? 'Pass' : 'Fail'}
          </span>
          {g.detail && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>{g.detail}</span>}
        </div>
      ))}
      <div style={styles.hashRow}>
        <code style={{ background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          {hash}
        </code>
      </div>
    </div>
  )
}

function EventCard({ event }) {
  const [open, setOpen] = useState(false)
  const sc = statusColors[event.status]

  return (
    <div style={styles.card}>
      {/* Timeline dot */}
      <div style={{ ...styles.dot, borderColor: sc.dot }} />

      <div className="glass-card" style={styles.cardContent}>
        <div style={styles.cardHeader}>
          <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>
            {event.badge}
          </span>
          <span style={styles.time}>{event.time}</span>
        </div>
        <h3 style={styles.cardTitle}>{event.title}</h3>
        <p style={styles.reasoning}>{event.reasoning}</p>
        <button
          onClick={() => setOpen(!open)}
          style={styles.proofToggle}
        >
          {open ? '▾' : '▸'} Cryptographic Proof & Gates
        </button>
        {open && <GateList gates={event.gates} hash={event.hash} />}
      </div>
    </div>
  )
}

export default function Ledger() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 className="huge-title">Immutable Ledger</h1>
          <p style={styles.subtitle}>Cryptographic record of every agent action and decision.</p>
        </div>
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>3</span>
            <span style={styles.statLabel}>Total Events</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: 'var(--success)' }}>1</span>
            <span style={styles.statLabel}>Executed</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: 'var(--danger)' }}>2</span>
            <span style={styles.statLabel}>Blocked</span>
          </div>
        </div>
      </div>

      <div style={styles.timeline}>
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '40px 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 60,
    flexWrap: 'wrap',
    gap: 24,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 18,
    marginTop: 12,
    fontWeight: 500,
  },
  stats: {
    display: 'flex',
    gap: 40,
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 48,
    fontWeight: 800,
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  timeline: {
    position: 'relative',
    paddingLeft: 40,
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  card: {
    position: 'relative',
    display: 'flex',
    gap: 0,
  },
  dot: {
    position: 'absolute',
    left: -46,
    top: 32,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: 'var(--bg)',
    border: '4px solid var(--border)',
    zIndex: 2,
    boxShadow: '0 0 0 6px rgba(0,0,0,0.5)',
    animation: 'pulse 2s infinite',
  },
  cardContent: {
    flex: 1,
    padding: 32,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    padding: '6px 12px',
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  time: {
    fontSize: 14,
    color: 'var(--text-muted)',
    fontFamily: 'JetBrains Mono, monospace',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 12,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  reasoning: {
    fontSize: 16,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  proofToggle: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  gateList: {
    marginTop: 20,
    padding: 24,
    background: 'rgba(0,0,0,0.5)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    border: '1px solid rgba(255,255,255,0.05)',
  },
  gateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 14,
  },
  hashRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
}
