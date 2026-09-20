const DOT_COLOR = { healed: 'var(--success)', alert: 'var(--danger)', info: 'var(--text-muted)' }

export default function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.leaving ? 'toast--leaving' : ''}`} onClick={() => onDismiss(t.id)}>
          <span className="toast-icon" style={{ background: DOT_COLOR[t.kind] ?? DOT_COLOR.info }} />
          <span className="toast-text">
            <strong>{t.title}</strong>{t.detail ? ` -- ${t.detail}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
