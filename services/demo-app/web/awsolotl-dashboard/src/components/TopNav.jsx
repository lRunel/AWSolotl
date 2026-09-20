const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'ask', label: 'Ask' },
  { id: 'docs', label: 'Docs' },
]

export default function TopNav({ activeTab, setActiveTab, connected }) {
  return (
    <header style={styles.nav}>
      <div style={styles.logo}>
        <span style={styles.logoMark}>awsaxolotl</span>
        <sup style={styles.reg}>&reg;</sup>
      </div>

      <nav style={styles.links}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...styles.link, ...(activeTab === tab.id ? styles.linkActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div
        style={styles.statusPill}
        title={connected ? 'control-api connected' : 'control-api unreachable'}
      >
        <span className="dot" style={{ background: connected ? 'var(--success)' : 'var(--danger)' }} />
      </div>
    </header>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1180,
    margin: '0 auto',
    padding: '28px 40px 0',
  },
  logo: { display: 'flex', alignItems: 'flex-start', gap: 2 },
  logoMark: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: '-0.01em',
    color: 'var(--text-primary)',
  },
  reg: { fontSize: 10, color: 'var(--text-muted)' },
  links: {
    display: 'flex',
    gap: 32,
  },
  link: {
    fontFamily: 'var(--font-ui)',
    fontSize: 14.5,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 0',
    transition: 'color 0.2s ease',
  },
  linkActive: { color: 'var(--text-primary)', fontWeight: 700 },
  statusPill: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
