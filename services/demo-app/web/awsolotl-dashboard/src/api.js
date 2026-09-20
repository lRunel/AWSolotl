const BASE_URL = import.meta.env.VITE_CONTROL_API_URL || 'http://localhost:8090'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Rate limited -- retry in ${body.retry_after_s ?? '?'}s`)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `${res.status} ${res.statusText}`)
  }
  return res.json()
}

export const api = {
  health: () => request('/api/health'),
  ledger: (limit = 50) => request(`/api/ledger?limit=${limit}`),
  ledgerVerify: () => request('/api/ledger/verify'),
  ask: (question) => request('/api/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  triggerChaos: (scenario) => request(`/api/chaos/${scenario}`, { method: 'POST' }),
  setChaosConfig: (cfg) => request('/api/chaos/config', { method: 'POST', body: JSON.stringify(cfg) }),
}
