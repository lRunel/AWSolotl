import { useCallback, useRef, useState } from 'react'
import './index.css'
import TopNav from './components/TopNav'
import Overview from './components/Overview'
import Ledger from './components/Ledger'
import AskLedger from './components/AskLedger'
import Docs from './components/Docs'
import StartupOverlay from './components/StartupOverlay'
import AmbientBackground from './components/AmbientBackground'
import ToastStack from './components/Toast'
import CustomCursor from './components/CustomCursor'

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loaded, setLoaded] = useState(false)
  const [connected, setConnected] = useState(true)
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 250)
  }, [])

  const pushToast = useCallback((toast) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, ...toast }])
    setTimeout(() => dismissToast(id), 5000)
  }, [dismissToast])

  return (
    <>
      <AmbientBackground />
      <CustomCursor />
      {!loaded && <StartupOverlay onComplete={() => setLoaded(true)} />}

      {loaded && (
        <div style={{ animation: 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
          <TopNav activeTab={activeTab} setActiveTab={setActiveTab} connected={connected} />
          <main>
            {activeTab === 'overview' && <Overview setConnected={setConnected} pushToast={pushToast} />}
            {activeTab === 'ledger' && <Ledger />}
            {activeTab === 'ask' && <AskLedger />}
            {activeTab === 'docs' && <Docs />}
          </main>
        </div>
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

export default App
