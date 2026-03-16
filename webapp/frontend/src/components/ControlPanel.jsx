import { useEffect, useCallback } from 'react'
import { useSimStore } from '../store/useSimStore'

// ─── primitives ──────────────────────────────────────────────────────────────

function Sec({ children, label }) {
  return (
    <section style={{ padding: '13px 18px', borderBottom: '1px solid #21262d' }}>
      {label && <h3 style={{ color: '#4a90d9', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{label}</h3>}
      {children}
    </section>
  )
}

function Slider({ label, paramKey, min, max, step = 0.1, log = false }) {
  const val      = useSimStore(s => s[paramKey])
  const setParam = useSimStore(s => s.setParam)
  const toS   = log ? v => Math.log10(v) : v => v
  const fromS = log ? v => Math.pow(10, v) : v => v
  const dec = step < 0.1 ? 3 : step < 1 ? 2 : 1
  const disp = typeof val === 'number'
    ? (val < 0.01 ? val.toExponential(2) : val.toFixed(dec))
    : val

  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{disp}</span>
      </div>
      <input type='range' min={toS(min)} max={toS(max)} step={log ? 0.01 : step}
        value={toS(val)}
        onChange={e => setParam(paramKey, fromS(parseFloat(e.target.value)))}
        style={{ width: '100%', accentColor: '#4a90d9', cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', fontSize: 10, marginTop: 1 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

function NumInput({ label, paramKey, min, max, step = 0.5, unit }) {
  const val      = useSimStore(s => s[paramKey])
  const setParam = useSimStore(s => s.setParam)
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type='number' min={min} max={max} step={step} value={val}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParam(paramKey, v) }}
          style={{ flex: 1, background: '#010409', border: '1px solid #30363d', borderRadius: 6,
            color: '#e6edf3', padding: '5px 10px', fontFamily: 'monospace', fontSize: 13 }} />
        {unit && <span style={{ color: '#4b5563', fontSize: 12, width: 20 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ─── Vehicle selector ────────────────────────────────────────────────────────

const VEHICLES = [
  { id: 'quadcopter', label: '🚁 Quad',     sub: 'Altitude PID/LQR' },
  { id: 'f1tenth',    label: '🏎  F1TENTH', sub: 'Track following' },
  { id: 'pendulum',   label: '⚖  Pendulum', sub: 'Balance (4-state)' },
]

function VehicleSelector() {
  const vehicle    = useSimStore(s => s.vehicle)
  const setVehicle = useSimStore(s => s.setVehicle)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {VEHICLES.map(v => (
        <button key={v.id} onClick={() => setVehicle(v.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: vehicle === v.id ? '#0f2a4a' : '#161b22',
          border: `1px solid ${vehicle === v.id ? '#4a90d9' : '#21262d'}`,
          borderRadius: 8, cursor: 'pointer', textAlign: 'left',
          transition: 'border-color 0.15s',
        }}>
          <span style={{ fontSize: 16 }}>{v.label.split(' ')[0]}</span>
          <div>
            <div style={{ color: '#e6edf3', fontSize: 12, fontWeight: 600 }}>{v.label.split(' ').slice(1).join(' ')}</div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>{v.sub}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Mode toggle ─────────────────────────────────────────────────────────────

function ModeToggle() {
  const mode    = useSimStore(s => s.mode)
  const setMode = useSimStore(s => s.setMode)
  return (
    <div style={{ display: 'flex', background: '#010409', border: '1px solid #30363d', borderRadius: 8, padding: 3, gap: 3 }}>
      {['pid', 'lqr'].map(m => (
        <button key={m} onClick={() => setMode(m)} style={{
          flex: 1, padding: '7px 0', background: mode === m ? '#1d4ed8' : 'transparent',
          border: 'none', borderRadius: 6, color: mode === m ? '#fff' : '#6b7280',
          fontWeight: 700, fontSize: 13, cursor: 'pointer', textTransform: 'uppercase',
        }}>{m}</button>
      ))}
    </div>
  )
}

// ─── Per-vehicle param panels ────────────────────────────────────────────────

function QuadPanel({ mode }) {
  const gains = useSimStore(s => s.gains)
  return mode === 'pid' ? (
    <>
      <Slider label='Kp' paramKey='kp' min={0} max={20} step={0.1} />
      <Slider label='Ki' paramKey='ki' min={0} max={5}  step={0.05} />
      <Slider label='Kd' paramKey='kd' min={0} max={10} step={0.1} />
      <NumInput label='Target altitude' paramKey='setpoint' min={0} max={20} step={0.5} unit='m' />
      <NumInput label='Initial altitude' paramKey='initialZ' min={0} max={10} step={0.5} unit='m' />
      <NumInput label='Duration'         paramKey='duration'  min={2} max={30} step={1}   unit='s' />
    </>
  ) : (
    <>
      <Slider label='q1 — position'  paramKey='q1' min={0.1} max={200} step={0.5} />
      <Slider label='q2 — velocity'  paramKey='q2' min={0.1} max={50}  step={0.1} />
      <Slider label='r  — effort'    paramKey='r'  min={0.001} max={10} log />
      <NumInput label='Target altitude' paramKey='setpoint' min={0} max={20} step={0.5} unit='m' />
      <NumInput label='Initial altitude' paramKey='initialZ' min={0} max={10} step={0.5} unit='m' />
      <NumInput label='Duration'         paramKey='duration'  min={2} max={30} step={1}   unit='s' />
      {gains && (
        <div style={{ background:'#010409', border:'1px solid #21262d', borderRadius:6, padding:'8px 10px', marginTop:6 }}>
          <div style={{ color:'#6b7280', fontSize:10, marginBottom:4 }}>K gains</div>
          <div style={{ fontFamily:'monospace', fontSize:11, color:'#34d399' }}>
            [{gains.K[0].toFixed(4)}, {gains.K[1].toFixed(4)}]
          </div>
        </div>
      )}
    </>
  )
}

function F1Panel({ mode }) {
  const gains = useSimStore(s => s.gains)
  return (
    <>
      <NumInput label='Target speed' paramKey='f1TargetSpeed' min={0.5} max={7} step={0.5} unit='m/s' />
      <div style={{ color:'#4a90d9', fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', margin:'10px 0 6px' }}>Speed PID</div>
      <Slider label='Kp_v' paramKey='f1KpV' min={0} max={8}   step={0.1} />
      <Slider label='Ki_v' paramKey='f1KiV' min={0} max={2}   step={0.05} />
      <Slider label='Kd_v' paramKey='f1KdV' min={0} max={1}   step={0.01} />
      <div style={{ color:'#a78bfa', fontSize:10, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', margin:'10px 0 6px' }}>
        Lateral — {mode.toUpperCase()}
      </div>
      {mode === 'pid' ? (
        <>
          <Slider label='Kp_lat' paramKey='f1KpL' min={0} max={3}  step={0.05} />
          <Slider label='Ki_lat' paramKey='f1KiL' min={0} max={1}  step={0.01} />
          <Slider label='Kd_lat' paramKey='f1KdL' min={0} max={1}  step={0.01} />
        </>
      ) : (
        <>
          <Slider label='q1 — CTE penalty'     paramKey='f1Q1L' min={1} max={200} step={1} />
          <Slider label='q2 — heading penalty'  paramKey='f1Q2L' min={0.1} max={50} step={0.1} />
          <Slider label='r  — steer effort'     paramKey='f1RL'  min={0.001} max={5} log />
          {gains && (
            <div style={{ background:'#010409', border:'1px solid #21262d', borderRadius:6, padding:'8px 10px', marginTop:4 }}>
              <div style={{ color:'#6b7280', fontSize:10, marginBottom:4 }}>Lateral K gains</div>
              <div style={{ fontFamily:'monospace', fontSize:11, color:'#34d399' }}>
                [{gains.K[0].toFixed(4)}, {gains.K[1].toFixed(4)}]
              </div>
            </div>
          )}
        </>
      )}
      <NumInput label='Duration' paramKey='f1Duration' min={5} max={60} step={5} unit='s' />
    </>
  )
}

function PendulumPanel({ mode }) {
  const gains = useSimStore(s => s.gains)
  return (
    <>
      <NumInput label='Initial angle θ₀' paramKey='pendTheta0' min={0.01} max={0.5} step={0.01} unit='rad' />
      {mode === 'pid' ? (
        <>
          <div style={{ color:'#6b7280', fontSize:10, marginBottom:8 }}>
            PID on θ (angle). Needs high Kd for stability.
          </div>
          <Slider label='Kp' paramKey='pendKp' min={0} max={100} step={1} />
          <Slider label='Ki' paramKey='pendKi' min={0} max={5}   step={0.1} />
          <Slider label='Kd' paramKey='pendKd' min={0} max={30}  step={0.5} />
        </>
      ) : (
        <>
          <div style={{ color:'#6b7280', fontSize:10, marginBottom:8 }}>
            LQR on [x, ẋ, θ, θ̇]. q3/q4 dominate — they penalise angle.
          </div>
          <Slider label='q1 — cart pos'     paramKey='pendQ1' min={0.1} max={50}  step={0.5} />
          <Slider label='q2 — cart vel'     paramKey='pendQ2' min={0.1} max={20}  step={0.1} />
          <Slider label='q3 — pole angle'   paramKey='pendQ3' min={1}   max={500} step={5} />
          <Slider label='q4 — pole ang-vel' paramKey='pendQ4' min={0.1} max={50}  step={0.5} />
          <Slider label='r  — force effort' paramKey='pendR'  min={0.001} max={1} log />
          {gains && (
            <div style={{ background:'#010409', border:'1px solid #21262d', borderRadius:6, padding:'8px 10px', marginTop:4 }}>
              <div style={{ color:'#6b7280', fontSize:10, marginBottom:4 }}>K gains [x, ẋ, θ, θ̇]</div>
              <div style={{ fontFamily:'monospace', fontSize:11, color:'#34d399', lineHeight:1.6 }}>
                {gains.K.map(k => k.toFixed(3)).join(', ')}
              </div>
            </div>
          )}
        </>
      )}
      <NumInput label='Duration' paramKey='pendDuration' min={2} max={30} step={1} unit='s' />
    </>
  )
}

// ─── Playback ─────────────────────────────────────────────────────────────────

function Playback() {
  const { play, pause, reset, playing, points, playhead, scrub } = useSimStore()
  const progress    = points.length > 1 ? (playhead / (points.length - 1)) * 100 : 0
  const currentTime = points[playhead]?.t?.toFixed(2) ?? '0.00'
  const totalTime   = points[points.length - 1]?.t?.toFixed(1) ?? '0'
  const Btn = ({ onClick, label, accent, title }) => (
    <button onClick={onClick} title={title} style={{
      flex: 1, padding: '7px 0',
      background: accent ? '#1d4ed8' : '#161b22',
      border: `1px solid ${accent ? '#4a90d9' : '#30363d'}`,
      borderRadius: 6, color: '#e6edf3', fontSize: 15, cursor: 'pointer',
    }}>{label}</button>
  )
  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <Btn onClick={reset} label='⏮' title='Rewind (0)' />
        <Btn onClick={playing ? pause : play} label={playing ? '⏸' : '▶'} accent title='Play/Pause (Space)' />
      </div>
      <input type='range' min={0} max={Math.max(0, points.length-1)} value={playhead}
        onChange={e => scrub(parseInt(e.target.value))} disabled={!points.length}
        style={{ width:'100%', accentColor:'#4a90d9', marginBottom: 4 }} />
      <div style={{ display:'flex', justifyContent:'space-between', color:'#4b5563', fontSize:10 }}>
        <span>{currentTime}s / {totalTime}s</span>
        <span>{progress.toFixed(0)}%</span>
      </div>
      {!points.length && (
        <p style={{ color:'#374151', fontSize:11, marginTop:8, textAlign:'center' }}>
          <kbd style={kbdStyle}>R</kbd> run · <kbd style={kbdStyle}>Space</kbd> play · <kbd style={kbdStyle}>←/→</kbd> scrub
        </p>
      )}
    </>
  )
}

const kbdStyle = { background:'#161b22', border:'1px solid #30363d', borderRadius:4, padding:'1px 5px', fontFamily:'monospace', color:'#9ca3af', fontSize:10 }

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ControlPanel() {
  const { vehicle, mode, runSimulation, loading, error, play, pause, reset, playing, getShareURL } = useSimStore()

  const handleKey = useCallback(e => {
    if (e.target.tagName === 'INPUT') return
    if (e.code === 'Space')       { e.preventDefault(); playing ? pause() : play() }
    else if (e.code === 'KeyR')   runSimulation()
    else if (e.code === 'Digit0' || e.code === 'Home') reset()
    else if (e.code === 'ArrowRight') { const s = useSimStore.getState(); s.scrub(Math.min(s.playhead+5, s.points.length-1)) }
    else if (e.code === 'ArrowLeft')  { const s = useSimStore.getState(); s.scrub(Math.max(s.playhead-5, 0)) }
  }, [playing, play, pause, reset, runSimulation])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  function handleShare() {
    prompt('Copy this URL to share your tuning:', getShareURL())
  }

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <Sec label='Vehicle'><VehicleSelector /></Sec>
      <Sec label='Controller'><ModeToggle /></Sec>
      <Sec label='Parameters'>
        {vehicle === 'quadcopter' && <QuadPanel mode={mode} />}
        {vehicle === 'f1tenth'    && <F1Panel   mode={mode} />}
        {vehicle === 'pendulum'   && <PendulumPanel mode={mode} />}
      </Sec>
      <Sec>
        <button onClick={runSimulation} disabled={loading} style={{
          width:'100%', padding:'11px 0', marginBottom:8,
          background: loading ? '#1a2032' : 'linear-gradient(135deg, #1d4ed8, #4a90d9)',
          border: loading ? '1px solid #30363d' : 'none',
          borderRadius:8, color:'#fff', fontWeight:700, fontSize:14,
          cursor: loading ? 'wait' : 'pointer',
          boxShadow: loading ? 'none' : '0 0 18px rgba(74,144,217,0.2)',
        }}>
          {loading ? 'Simulating…' : '▶  Run  (R)'}
        </button>
        <button onClick={handleShare} style={{
          width:'100%', padding:'7px 0', background:'none',
          border:'1px solid #30363d', borderRadius:8,
          color:'#6b7280', fontSize:12, cursor:'pointer',
        }}>🔗 Share this tuning</button>
        {error && <p style={{ color:'#f87171', fontSize:11, marginTop:7 }}>{error}</p>}
      </Sec>
      <Sec label='Playback'><Playback /></Sec>
    </div>
  )
}
