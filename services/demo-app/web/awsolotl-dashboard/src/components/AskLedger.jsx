import { useState } from 'react'
import { api } from '../api'

const EXAMPLES = [
  'Why did the web service restart?',
  'What happened to payments?',
  'Was anything blocked?',
]

export default function AskLedger() {
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  const [history, setHistory] = useState([])

  async function ask(q) {
    const text = (q ?? question).trim()
    if (!text || pending) return
    setPending(true)
    try {
      const result = await api.ask(text)
      setHistory((prev) => [{ question: text, ...result }, ...prev])
      setQuestion('')
    } catch (e) {
      setHistory((prev) => [{ question: text, answer: `Error: ${e.message}`, cited: false, cited_record_ids: [] }, ...prev])
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span className="eyebrow">Cite or say unknown</span>
        <h1 className="page-title">Ask the ledger</h1>
        <p style={styles.subtitle}>
          Every answer names real ledger record ids, or says it doesn't
          know. This is deterministic keyword retrieval over the live chain
          -- not an LLM composing a plausible-sounding guess.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask() }} style={styles.form}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why did the web service restart at..."
          style={styles.input}
        />
        <button className="btn btn--accent" type="submit" disabled={pending}>
          {pending ? 'Asking…' : 'Ask'}
        </button>
      </form>

      <div style={styles.examples}>
        {EXAMPLES.map((ex) => (
          <button key={ex} className="btn" style={styles.exampleBtn} onClick={() => ask(ex)}>{ex}</button>
        ))}
      </div>

      <div style={styles.history}>
        {history.map((entry, i) => (
          <div key={i} className="panel" style={styles.entry}>
            <p style={styles.q}>{entry.question}</p>
            <p style={{ ...styles.a, color: entry.cited ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {entry.answer}
            </p>
            {entry.cited_record_ids?.length > 0 && (
              <div style={styles.cites}>
                {entry.cited_record_ids.map((id) => (
                  <span key={id} className="badge badge--muted">record #{id}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: 760, margin: '0 auto', padding: '56px 40px 80px' },
  header: { marginBottom: 36 },
  subtitle: { color: 'var(--text-secondary)', fontSize: 15.5, lineHeight: 1.65, marginTop: 16, maxWidth: 560 },
  form: { display: 'flex', gap: 10, marginBottom: 14 },
  input: {
    flex: 1, padding: '14px 18px', fontSize: 14.5, borderRadius: 999, border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
  },
  examples: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 40 },
  exampleBtn: { fontSize: 12, padding: '7px 14px', fontWeight: 500 },
  history: { display: 'flex', flexDirection: 'column', gap: 16 },
  entry: { padding: '20px 24px' },
  q: { fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 },
  a: { fontSize: 14.5, lineHeight: 1.7 },
  cites: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
}
