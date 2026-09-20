import { useState } from 'react'

const services = [
  { name: 'Web API', tag: 'Frontend', status: 'Healthy', ok: true },
  { name: 'Payments API', tag: 'Backend', status: 'Healthy', ok: true },
  { name: 'Lockstep Brain', tag: 'Lambda', status: 'Monitoring', ok: true },
]

function MetricCard({ label, value, color, subtext }) {
  return (
    <div className="glass-card" style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <div style={{ ...styles.metricValue, color: color || 'var(--text-primary)' }}>{value}</div>
      {subtext && <span style={styles.metricSub}>{subtext}</span>}
    </div>
  )
}

function ServiceRow({ service }) {
  return (
    <div className="glass-card" style={styles.serviceRow}>
      <div style={styles.serviceName}>
        <span style={styles.serviceNameText}>{service.name}</span>
        <span style={styles.serviceTag}>{service.tag}</span>
      </div>
      <span style={{
        ...styles.serviceStatus,
        background: service.ok ? 'var(--success-light)' : 'var(--danger-light)',
        color: service.ok ? 'var(--success)' : 'var(--danger)',
      }}>
        {service.ok && <span style={styles.serviceDot} />}
        {service.status}
      </span>
    </div>
  )
}

export default function Health() {
  const [chaosOn, setChaosOn] = useState(false)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 className="huge-title">System Health</h1>
          <p style={styles.subtitle}>Real-time ADOT telemetry and agent interventions.</p>
        </div>
        <div style={styles.chaosCard}>
          <div>
            <div style={styles.chaosTitle}>Chaos Mode</div>
            <div style={styles.chaosSub}>Inject latency & errors</div>
          </div>
          <button
            onClick={() => setChaosOn(!chaosOn)}
            style={{
              ...styles.toggle,
              background: chaosOn ? 'var(--danger)' : 'var(--border)',
            }}
          >
            <span style={{
              ...styles.toggleKnob,
              transform: chaosOn ? 'translateX(20px)' : 'translateX(0)',
            }} />
          </button>
        </div>
      </div>

      <h3 style={styles.sectionLabel}>Core Metrics</h3>
      <div style={styles.metricsGrid}>
        <MetricCard label="Portfolio Latency (p99)" value="42 ms" subtext="↓ 8% from yesterday" />
        <MetricCard label="Error Rate" value="0.01%" color="var(--success)" subtext="Within SLA" />
        <MetricCard label="Agent Interventions" value="14" color="var(--accent)" subtext="Last 24 hours" />
      </div>

      <h3 style={styles.sectionLabel}>Service Status</h3>
      <div style={styles.serviceList}>
        {services.map((s, i) => <ServiceRow key={i} service={s} />)}
      </div>

      {chaosOn && (
        <div style={styles.chaosAlert}>
          ⚡ Chaos Mode is active — artificial faults are being injected into the target application.
        </div>
      )}
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
    alignItems: 'center',
    marginBottom: 60,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 18,
    marginTop: 12,
    fontWeight: 500,
  },
  chaosCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    background: 'rgba(255, 51, 102, 0.1)',
    border: '1px solid rgba(255, 51, 102, 0.3)',
    backdropFilter: 'blur(10px)',
    borderRadius: 100,
    padding: '16px 24px',
  },
  chaosTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--danger)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  chaosSub: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    padding: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'white',
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 24,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 24,
    marginBottom: 60,
  },
  metricCard: {
    padding: 32,
  },
  metricLabel: {
    display: 'block',
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metricValue: {
    fontSize: 48,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1,
  },
  metricSub: {
    display: 'block',
    marginTop: 12,
    fontSize: 13,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  serviceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  serviceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
  },
  serviceName: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  serviceNameText: {
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: '-0.02em',
  },
  serviceTag: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    background: 'rgba(255,255,255,0.05)',
    padding: '4px 10px',
    borderRadius: 100,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  serviceStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    padding: '6px 16px',
    borderRadius: 100,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  serviceDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--success)',
    boxShadow: '0 0 10px var(--success)',
  },
  chaosAlert: {
    marginTop: 40,
    padding: '24px 32px',
    background: 'rgba(255, 204, 0, 0.1)',
    border: '1px solid rgba(255, 204, 0, 0.3)',
    backdropFilter: 'blur(20px)',
    borderRadius: 'var(--radius)',
    color: 'var(--warning)',
    fontWeight: 600,
    fontSize: 16,
    animation: 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
}
