export default function TopNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'ledger', label: 'Ledger', icon: '📋' },
    { id: 'health', label: 'Health', icon: '💓' },
    { id: 'docs', label: 'Docs', icon: '📄' },
  ]

  return (
    <header style={styles.nav}>
      <div style={styles.left}>
        <div style={styles.logo}>
          <span style={{ fontSize: 20 }}>🦎</span>
          <span style={styles.logoText}>AWSolotl</span>
        </div>
        <span style={styles.divider}>/</span>
        <nav style={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={styles.right}>
        <div style={styles.status}>
          <span style={styles.statusDot} />
          <span style={styles.statusText}>All systems nominal</span>
        </div>
      </div>
    </header>
  )
}

const styles = {
  nav: {
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    background: 'transparent',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logoText: {
    fontWeight: 800,
    fontSize: 24,
    color: 'var(--text-primary)',
    letterSpacing: '-0.04em',
    textTransform: 'uppercase',
  },
  divider: {
    color: 'var(--border-hover)',
    fontSize: 24,
    userSelect: 'none',
    fontWeight: 300,
  },
  tabs: {
    display: 'flex',
    gap: 8,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 100,
    border: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(0,0,0,0.2)',
    backdropFilter: 'blur(10px)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tabActive: {
    background: 'var(--text-primary)',
    color: '#000',
    border: '1px solid var(--text-primary)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    background: 'rgba(0, 255, 170, 0.1)',
    border: '1px solid rgba(0, 255, 170, 0.2)',
    backdropFilter: 'blur(10px)',
    borderRadius: 100,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--success)',
    boxShadow: '0 0 10px var(--success)',
  },
  statusText: {
    fontSize: 12,
    color: 'var(--success)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
}
