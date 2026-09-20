import { useEffect, useState } from 'react'
import { api } from '../api'

const resultColors = { pass: 'var(--success)', fail: 'var(--danger)', skip: 'var(--text-muted)' }

function statusOf(record) {
  if (record.result === 'executed') return { badge: 'Executed', cls: 'badge--success' }
  if (record.result?.startsWith('deny at')) return { badge: 'Blocked', cls: 'badge--danger' }
  return { badge: 'Failed', cls: 'badge--warning' }
}

function GateList({ gates }) {
  return (
    <div style={styles.gateList}>
      {Object.entries(gates || {}).map(([name, g]) => (
        <div key={name} style={styles.gateRow}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{name}</span>
          <span style={{ color: resultColors[g.decision === 'pass' ? 'pass' : 'fail'], fontWeight: 600, textTransform: 'capitalize' }}>
            {g.decision}
          </span>
          {g.why && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{g.why}</span>}
        </div>
      ))}
    </div>
  )
}

function RecordCard({ record }) {
  const [open, setOpen] = useState(false)
  const status = statusOf(record)
  const action = record.action || {}

  return (
    <div className="panel panel--interactive" style={styles.card}>
      <div style={styles.cardHeader}>
        <span className={`badge ${status.cls}`}>{status.badge}</span>
        <span className="mono" style={styles.recordId}>#{record.record_id}</span>
      </div>
      <h3 style={styles.cardTitle}>{action.tool}</h3>
      <p style={styles.incident}>incident {record.incident_id} &middot; actor {record.actor}</p>
      <button onClick={() => setOpen(!open)} style={styles.toggle}>
        {open ? '−' : '+'} Gates &amp; cryptographic proof
      </button>
      {open && (
        <>
          <GateList gates={record.gates} />
          <div style={styles.hashRow}>
            <code style={{ fontSize: 11 }}>prev {record.prev_hash.slice(0, 16)}&hellip;</code>
            <code style={{ fontSize: 11 }}>hash {record.hash.slice(0, 16)}&hellip;</code>
          </div>
        </>
      )}
    </div>
  )
}

export default function Ledger() {
  const [records, setRecords] = useState([])
  const [verify, setVerify] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const [{ records: r }, v] = await Promise.all([api.ledger(50), api.ledgerVerify()])
        if (!cancelled) { setRecords(r); setVerify(v) }
      } catch { /* Overview's poller already surfaces connectivity state */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const executed = records.filter((r) => r.result === 'executed').length
  const blocked = records.length - executed

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span className="eyebrow">Hash-chained &middot; append-only</span>
          <h1 className="page-title">The Ledger</h1>
        </div>
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{records.length}</span>
            <span className="eyebrow">Records</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: 'var(--success)' }}>{executed}</span>
            <span className="eyebrow">Executed</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: 'var(--danger)' }}>{blocked}</span>
            <span className="eyebrow">Blocked</span>
          </div>
          {verify && (
            <span className={`badge ${verify.valid ? 'badge--success' : 'badge--danger'}`} style={{ alignSelf: 'center' }}>
              {verify.valid ? `Chain verified (${verify.records_checked})` : `Tampered: ${verify.reason}`}
            </span>
          )}
        </div>
      </div>

      <div style={styles.list}>
        {records.length === 0 && (
          <p style={styles.emptyNote}>
            No incidents yet. Go to <strong>Overview</strong> and trigger a chaos scenario --
            every gate run and remediation the watchdog performs lands here in real time.
          </p>
        )}
        {records.map((r) => <RecordCard key={r.hash} record={r} />)}
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: 900, margin: '0 auto', padding: '56px 40px 80px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, marginBottom: 44 },
  stats: { display: 'flex', gap: 28, alignItems: 'flex-end' },
  statItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statValue: { fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 500, lineHeight: 1 },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  emptyNote: { color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, padding: '32px 0' },
  card: { padding: '24px 26px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  recordId: { color: 'var(--text-muted)', fontSize: 12 },
  cardTitle: { fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 },
  incident: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 },
  toggle: { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  gateList: { marginTop: 16, padding: '16px 18px', background: 'var(--surface-muted)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--border)' },
  gateRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, flexWrap: 'wrap' },
  hashRow: { marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' },
}
