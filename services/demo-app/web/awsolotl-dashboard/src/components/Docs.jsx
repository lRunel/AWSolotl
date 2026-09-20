const docs = [
  {
    title: 'Lockstep Recall Design PDF',
    desc: 'Original 2-person architecture and threat model.',
    href: '/docs/Lockstep-Recall-2-Person-Design (1).pdf',
    icon: '📐',
  },
  {
    title: 'System Design & Team Plan PDF',
    desc: 'Full system design, gate definitions, and sprint plan.',
    href: '/docs/Lockstep-System-Design-and-Team-Plan.pdf',
    icon: '🏗️',
  },
  {
    title: 'Hackathon Build Book PDF',
    desc: 'Pitch deck and build narrative for the AWS hackathon.',
    href: '/docs/ResiliAgent-AWS-Hackathon-Build-Book.pdf',
    icon: '📕',
  },
]

function DocCard({ doc }) {
  return (
    <a href={doc.href} target="_blank" rel="noopener noreferrer" className="glass-card" style={styles.card}>
      <span style={styles.icon}>{doc.icon}</span>
      <div>
        <div style={styles.docTitle}>{doc.title}</div>
        <div style={styles.docDesc}>{doc.desc}</div>
      </div>
      <span style={styles.arrow}>→</span>
    </a>
  )
}

export default function Docs() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 className="huge-title">Documentation</h1>
        <p style={styles.subtitle}>Project design documents and architecture references.</p>
      </div>

      <div style={styles.grid}>
        {docs.map((doc, i) => <DocCard key={i} doc={doc} />)}
      </div>

      <div style={styles.infoBox}>
        <span style={{ fontSize: 20 }}>🦎</span>
        <div>
          <div style={styles.infoTitle}>About AWSolotl</div>
          <p style={styles.infoText}>
            AWSolotl (formerly Lockstep Recall / ResiliAgent) is an AI-powered autonomous infrastructure 
            agent with a cryptographic control plane. Every action passes through 5 safety gates before 
            execution, and every decision is recorded in an immutable, hash-chained ledger.
          </p>
        </div>
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
    marginBottom: 60,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 18,
    marginTop: 12,
    fontWeight: 500,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '32px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.3s ease',
  },
  icon: {
    fontSize: 40,
    flexShrink: 0,
  },
  docTitle: {
    fontWeight: 700,
    fontSize: 20,
    marginBottom: 8,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  docDesc: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  arrow: {
    marginLeft: 'auto',
    fontSize: 24,
    color: 'var(--text-muted)',
    flexShrink: 0,
    transition: 'transform 0.3s ease, color 0.3s ease',
  },
  infoBox: {
    marginTop: 60,
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
    padding: '40px',
    background: 'rgba(232, 134, 106, 0.1)',
    border: '1px solid rgba(232, 134, 106, 0.2)',
    backdropFilter: 'blur(20px)',
    borderRadius: 'var(--radius)',
  },
  infoTitle: {
    fontWeight: 700,
    fontSize: 18,
    marginBottom: 12,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoText: {
    fontSize: 16,
    lineHeight: 1.8,
    color: 'var(--text-secondary)',
  },
}
