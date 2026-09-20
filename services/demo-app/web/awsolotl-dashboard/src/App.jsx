import { useState } from 'react'
import './index.css'
import TopNav from './components/TopNav'
import Ledger from './components/Ledger'
import Health from './components/Health'
import Docs from './components/Docs'
import StartupOverlay from './components/StartupOverlay'

function App() {
  const [activeTab, setActiveTab] = useState('ledger')
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      {/* Liquid / Gooey Background */}
      <div className="goo-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {!loaded && <StartupOverlay onComplete={() => setLoaded(true)} />}
      
      {loaded && (
        <div className="app" style={{ animation: 'fadeUp 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <TopNav activeTab={activeTab} setActiveTab={setActiveTab} />
          <main className="main-content" style={{ position: 'relative', zIndex: 10 }}>
            {activeTab === 'ledger' && <Ledger />}
            {activeTab === 'health' && <Health />}
            {activeTab === 'docs' && <Docs />}
          </main>
        </div>
      )}
    </>
  )
}

export default App
