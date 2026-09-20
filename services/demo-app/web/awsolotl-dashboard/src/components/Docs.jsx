const docs = [
  { title: 'Lockstep Recall -- 2-Person Design', desc: 'Original architecture, threat model, and iteration plan.', href: '/docs/Lockstep-Recall-2-Person-Design (1).pdf' },
  { title: 'System Design & Team Plan', desc: 'Full system design, gate definitions, and sprint plan.', href: '/docs/Lockstep-System-Design-and-Team-Plan.pdf' },
  { title: 'Hackathon Build Book', desc: 'Pitch deck and build narrative for the AWS hackathon.', href: '/docs/ResiliAgent-AWS-Hackathon-Build-Book.pdf' },
  { title: 'Hackathon Writeup', desc: 'What shipped, what was cut, and why.', href: '/docs/wemake-hackathon-writeup.pdf' },
]

function DocCard({ doc }) {
  return (
    <a href={doc.href} target="_blank" rel="noopener noreferrer" className="panel panel--interactive" style={styles.card}>
      <div>
        <div style={styles.docTitle}>{doc.title}</div>
        <div style={styles.docDesc}>{doc.desc}</div>
      </div>
      <span style={styles.arrow}>&rarr;</span>
    </a>
  )
}

export default function Docs() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span className="eyebrow">Reference</span>
        <h1 className="page-title">Documentation</h1>
      </div>

      <div style={styles.grid}>
        {docs.map((doc) => <DocCard key={doc.href} doc={doc} />)}
      </div>

      <div className="panel" style={styles.infoBox}>
        <div style={styles.infoTitle}>About this runtime</div>
        <p style={styles.infoText}>
          Lockstep Recall (internally AWSolotl) proves an AI agent's action
          is safe before it runs, bounds the damage it can do, watches it
          while it executes, and writes a signed record. Every action passes
          through five deterministic gates before execution -- no LLM is
          ever in the enforcement path.
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth: 900, margin: '0 auto', padding: '56px 40px 80px' },
  header: { marginBottom: 44 },
  grid: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '24px 28px', textDecoration: 'none', color: 'inherit' },
  docTitle: { fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--text-primary)', letterSpacing: '-0.01em' },
  docDesc: { fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 },
  arrow: { fontSize: 20, color: 'var(--text-muted)', flexShrink: 0 },
  infoBox: { marginTop: 44, padding: '32px 34px' },
  infoTitle: { fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  infoText: { fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: 640 },
}
