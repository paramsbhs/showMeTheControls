import { useState } from 'react'
import SimCanvas from './components/SimCanvas'
import ControlPanel from './components/ControlPanel'
import PlotPanel from './components/PlotPanel'
import MetricsPanel from './components/MetricsPanel'
import PresetGallery from './components/PresetGallery'
import { useSimStore } from './store/useSimStore'

const SIDEBAR_W = 280
const RIGHT_W = 300

const RIGHT_TABS = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'plots',   label: 'Plots' },
  { id: 'presets', label: 'Presets' },
]

export default function App() {
  const [rightTab, setRightTab] = useState('metrics')
  const loading = useSimStore((s) => s.loading)

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: '#010409', color: '#e6edf3',
      fontFamily: '"Inter", system-ui, sans-serif',
      overflow: 'hidden',
    }}>

      {/* Left sidebar */}
      <aside style={{
        width: SIDEBAR_W, flexShrink: 0,
        background: '#0d1117',
        borderRight: '1px solid #21262d',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #21262d',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>⚙</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>ControlLab</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>Control Systems Playground</div>
          </div>
        </div>
        <ControlPanel />
      </aside>

      {/* Center — 3D canvas */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(1,4,9,0.75)', backdropFilter: 'blur(4px)',
          }}>
            <div style={{ color: '#4a90d9', fontSize: 15, fontWeight: 600 }}>
              Simulating…
            </div>
          </div>
        )}
        <SimCanvas />
      </main>

      {/* Right panel */}
      <aside style={{
        width: RIGHT_W, flexShrink: 0,
        background: '#0d1117',
        borderLeft: '1px solid #21262d',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #21262d', flexShrink: 0 }}>
          {RIGHT_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setRightTab(id)}
              style={{
                flex: 1, padding: '11px 0',
                background: 'none', border: 'none',
                borderBottom: rightTab === id ? '2px solid #4a90d9' : '2px solid transparent',
                color: rightTab === id ? '#4a90d9' : '#6b7280',
                fontWeight: 600, fontSize: 12,
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
          {rightTab === 'metrics' && <MetricsPanel />}
          {rightTab === 'plots'   && <PlotPanel />}
          {rightTab === 'presets' && <PresetGallery />}
        </div>
      </aside>
    </div>
  )
}
