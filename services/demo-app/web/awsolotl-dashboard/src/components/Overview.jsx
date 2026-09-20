import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import Magnetic from './Magnetic'

const SCENARIOS = [
  { id: 'memory_leak', tag: 'Memory', filter: 'resource', title: 'Leak memory', subtitle: '+10MB per request, unbounded', pattern: 'stack' },
  { id: 'cpu_spike', tag: 'Compute', filter: 'resource', title: 'Spike the CPU', subtitle: 'blocks the event loop for 2s', pattern: 'bars' },
  { id: 'flaky_endpoint', tag: 'Reliability', filter: 'reliability', title: 'Go flaky', subtitle: '50% of requests fail', pattern: 'dither' },
  { id: 'crash', tag: 'Critical', filter: 'reliability', title: 'Crash the process', subtitle: 'hard exit, watchdog respawns it', pattern: 'break' },
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'resource', label: 'Resource' },
  { id: 'reliability', label: 'Reliability' },
]

// Generative visual standing in for a project photo -- there isn't one, so
// each card gets a small live pattern instead of a stock image.
function CardVisual({ pattern, busy }) {
  return (
    <div className={`proj-card__visual ${busy ? 'proj-card__visual--busy' : ''}`} style={visualStyles.base(pattern)}>
      {pattern === 'stack' && (
        <div style={visualStyles.stackWrap}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} style={visualStyles.stackBar(i)} />)}
        </div>
      )}
      {pattern === 'bars' && (
        <div style={visualStyles.barsWrap}>
          {Array.from({ length: 12 }, (_, i) => <div key={i} style={visualStyles.bar(i)} />)}
        </div>
      )}
      {pattern === 'dither' && (
        <div style={visualStyles.ditherWrap}>
          {Array.from({ length: 60 }, (_, i) => <span key={i} style={visualStyles.ditherDot(i)} />)}
        </div>
      )}
      {pattern === 'break' && (
        <svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
          <path d="M0,100 L90,100 L110,60 L140,140 L160,80 L180,100 L300,100" fill="none" stroke="rgba(20,18,14,0.5)" strokeWidth="1.5" />
          <path d="M0,120 L300,120" fill="none" stroke="rgba(20,18,14,0.18)" strokeWidth="1" />
        </svg>
      )}
    </div>
  )
}

function ScenarioCard({ s, busy, onTrigger }) {
  return (
    <Magnetic strength={4} block>
      <button className="proj-card" onClick={() => onTrigger(s.id)} disabled={busy === s.id} data-cursor-hover>
        <CardVisual pattern={s.pattern} busy={busy === s.id} />
        <div className="proj-card__caption">
          <div>
            <div className="proj-card__title">{busy === s.id ? 'Sending…' : s.title}</div>
            <div className="proj-card__subtitle">{s.subtitle}</div>
          </div>
          <span className="proj-card__arrow">&#8599;</span>
        </div>
      </button>
    </Magnetic>
  )
}

function ServiceRow({ name, healthy, port }) {
  return (
    <div className="thin-row">
      <span className="dot" style={{ background: healthy ? 'var(--success)' : 'var(--danger)' }} />
      <span style={styles.thinRowName}>{name}</span>
      <span className="mono" style={styles.thinRowMeta}>:{port}</span>
      <span className={`badge ${healthy ? 'badge--success' : 'badge--danger'}`} style={{ marginLeft: 'auto' }}>{healthy ? 'Healthy' : 'Down'}</span>
    </div>
  )
}

export default function Overview({ setConnected, pushToast }) {
  const [health, setHealth] = useState(null)
  const [busy, setBusy] = useState(null)
  const [log, setLog] = useState([])
  const [chaosCfg, setChaosCfg] = useState({ latency_ms: 0, error_rate: 0 })
  const [filter, setFilter] = useState('all')
  const pushedIncident = useRef(null)
  const wasHealthy = useRef(true)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const h = await api.health()
        if (cancelled) return
        setHealth(h)
        setConnected(true)

        const allHealthy = (h.services ?? []).every((s) => s.healthy)
        if (!allHealthy) {
          if (wasHealthy.current) pushToast?.({ kind: 'alert', title: 'Something just broke', detail: 'the watchdog is on it' })
          wasHealthy.current = false
        } else {
          wasHealthy.current = true
        }

        const incident = h.watchdog?.last_incident
        if (incident && incident.hash !== pushedIncident.current) {
          pushedIncident.current = incident.hash
          const tool = incident.action?.tool
          const ok = incident.result === 'executed'
          setLog((prev) => [
            { id: incident.hash, text: `Watchdog: ${incident.result} (${tool})`, ok },
            ...prev,
          ].slice(0, 12))
          if (ok) pushToast?.({ kind: 'healed', title: 'Fixed and logged', detail: tool })
        }
      } catch {
        if (!cancelled) setConnected(false)
      }
    }
    poll()
    const id = setInterval(poll, 1500)
    return () => { cancelled = true; clearInterval(id) }
  }, [setConnected, pushToast])

  async function trigger(scenario) {
    setBusy(scenario)
    try {
      await api.triggerChaos(scenario)
      setLog((prev) => [{ id: `${scenario}-${Date.now()}`, text: `Triggered: ${scenario}`, ok: null }, ...prev].slice(0, 12))
    } catch (e) {
      setLog((prev) => [{ id: `${scenario}-err-${Date.now()}`, text: `${scenario} failed: ${e.message}`, ok: false }, ...prev].slice(0, 12))
    } finally {
      setBusy(null)
    }
  }

  async function applyChaosConfig() {
    setBusy('config')
    try {
      await api.setChaosConfig({ ...chaosCfg, pool_leak: false })
      setLog((prev) => [{ id: `cfg-${Date.now()}`, text: `payments-api chaos config set: ${chaosCfg.latency_ms}ms / ${Math.round(chaosCfg.error_rate * 100)}% errors`, ok: null }, ...prev].slice(0, 12))
    } catch (e) {
      setLog((prev) => [{ id: `cfg-err-${Date.now()}`, text: `config failed: ${e.message}`, ok: false }, ...prev].slice(0, 12))
    } finally {
      setBusy(null)
    }
  }

  const services = health?.services ?? []
  const watchdogRunning = health?.watchdog?.running
  const visibleScenarios = SCENARIOS.filter((s) => filter === 'all' || s.filter === filter)

  return (
    <div style={styles.container}>
      <div style={styles.hero} className="enter">
        <span className="eyebrow">Live local runtime</span>
        <h1 className="display-title" style={{ marginTop: 14 }}>
          <span className="reveal-line"><span className="reveal-line__inner" style={{ '--reveal-delay': '0.05s' }}>Selected Incidents</span></span>
        </h1>
        <p style={styles.subtitle}>
          Two real services run underneath this page. Pick one below and
          send it for real -- the watchdog detects it, runs the fix through
          Gates 1&ndash;5, and writes the outcome to the ledger.
        </p>
        <div className="pill-row" style={{ marginTop: 28 }}>
          {FILTERS.map((f) => {
            const count = f.id === 'all' ? SCENARIOS.length : SCENARIOS.filter((s) => s.filter === f.id).length
            return (
              <button key={f.id} className={`pill ${filter === f.id ? 'pill--active' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label} <sup>{count}</sup>
              </button>
            )
          })}
        </div>
      </div>

      <div style={styles.cardGrid}>
        {visibleScenarios.map((s) => <ScenarioCard key={s.id} s={s} busy={busy} onTrigger={trigger} />)}
      </div>

      <div style={styles.rule} />

      <div style={styles.grid}>
        <div style={styles.leftCol} className="enter">
          <span className="eyebrow">Service status</span>
          <div style={styles.thinList}>
            {services.length === 0 && <div style={styles.emptyNote}>Connecting to control-api&hellip;</div>}
            {services.map((s) => <ServiceRow key={s.name} {...s} />)}
            <div className="thin-row">
              <span className="dot" style={{ background: watchdogRunning ? 'var(--success)' : 'var(--text-muted)' }} />
              <span style={styles.thinRowName}>Watchdog</span>
              <span className="mono" style={styles.thinRowMeta}>MAD z-score</span>
              <span className={`badge ${watchdogRunning ? 'badge--success' : 'badge--muted'}`} style={{ marginLeft: 'auto' }}>
                {watchdogRunning ? 'Watching' : 'Idle'}
              </span>
            </div>
          </div>

          <span className="eyebrow" style={{ marginTop: 40, display: 'block' }}>Recent activity</span>
          <div className="panel scrollbar-thin" style={styles.logBox}>
            {log.length === 0 && <div style={styles.emptyNote}>Nothing yet -- trigger an incident above.</div>}
            {log.map((entry) => (
              <div key={entry.id} style={styles.logRow}>
                <span
                  className="dot"
                  style={{
                    background: entry.ok === true ? 'var(--success)' : entry.ok === false ? 'var(--danger)' : 'var(--text-muted)',
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
                <span className="mono" style={styles.logText}>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="enter" style={{ ...styles.rightCol, animationDelay: '0.1s' }}>
          <span className="eyebrow">Degrade payments-api</span>
          <div className="panel" style={styles.configCard}>
            <label style={styles.sliderLabel}>
              Latency injection
              <span className="mono" style={styles.sliderValue}>{chaosCfg.latency_ms}ms</span>
            </label>
            <input
              type="range" min="0" max="5000" step="100"
              value={chaosCfg.latency_ms}
              onChange={(e) => setChaosCfg((c) => ({ ...c, latency_ms: Number(e.target.value) }))}
              style={styles.slider}
            />
            <label style={{ ...styles.sliderLabel, marginTop: 18 }}>
              Error rate
              <span className="mono" style={styles.sliderValue}>{Math.round(chaosCfg.error_rate * 100)}%</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={chaosCfg.error_rate}
              onChange={(e) => setChaosCfg((c) => ({ ...c, error_rate: Number(e.target.value) }))}
              style={styles.slider}
            />
            <Magnetic strength={10} block style={{ marginTop: 18 }}>
              <button className="btn btn--accent" style={{ width: '100%' }} disabled={busy === 'config'} onClick={applyChaosConfig}>
                Apply and wait for the watchdog
              </button>
            </Magnetic>
          </div>
        </div>
      </div>
    </div>
  )
}

const visualStyles = {
  base: (pattern) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: pattern === 'break' ? '#efe9e2' : '#eeece5',
  }),
  stackWrap: { display: 'flex', flexDirection: 'column', gap: 8, width: '60%' },
  stackBar: (i) => ({ height: 14, borderRadius: 7, background: `rgba(193,80,46,${0.15 + i * 0.14})`, width: `${100 - i * 12}%` }),
  barsWrap: { display: 'flex', alignItems: 'flex-end', gap: 6, height: '55%' },
  bar: (i) => ({ width: 10, height: `${20 + ((i * 37) % 80)}%`, background: 'rgba(20,18,14,0.55)', borderRadius: 3 }),
  ditherWrap: { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 10, width: '60%' },
  ditherDot: (i) => ({ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: (i * 7) % 3 === 0 ? 'rgba(193,80,46,0.7)' : 'rgba(20,18,14,0.18)' }),
}

const styles = {
  container: { maxWidth: 1180, margin: '0 auto', padding: '48px 40px 100px' },
  hero: { textAlign: 'center', maxWidth: 640, margin: '0 auto 44px' },
  subtitle: { color: 'var(--text-secondary)', fontSize: 15.5, lineHeight: 1.65, marginTop: 18 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28, marginBottom: 60 },
  rule: { height: 1, background: 'var(--border-strong)', margin: '0 0 48px' },
  grid: { display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 48 },
  leftCol: { display: 'flex', flexDirection: 'column' },
  rightCol: { display: 'flex', flexDirection: 'column' },
  thinList: { borderTop: '1px solid var(--border)', marginTop: 16 },
  thinRowName: { fontWeight: 600, fontSize: 14.5 },
  thinRowMeta: { fontSize: 12, color: 'var(--text-muted)' },
  emptyNote: { color: 'var(--text-muted)', fontSize: 13.5, padding: '20px 4px' },
  logBox: { padding: '18px 22px', maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 },
  logRow: { display: 'flex', gap: 10 },
  logText: { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 },
  configCard: { padding: '22px 24px', marginTop: 16 },
  sliderLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 },
  sliderValue: { color: 'var(--accent)' },
  slider: { width: '100%', marginTop: 10, accentColor: 'var(--accent)' },
}
