import { useState } from 'react'
import { useSimStore } from '../store/useSimStore'

const PRESETS = {
  quadcopter: {
    pid: [
      { id:'q-p1', name:'Tuned',          desc:'Well-balanced 5 m step',           kp:4,  ki:0.5, kd:2,   setpoint:5 },
      { id:'q-p2', name:'Aggressive',     desc:'Fast rise, ~15% overshoot',         kp:12, ki:1,   kd:4,   setpoint:5 },
      { id:'q-p3', name:'Sluggish',       desc:'Minimal overshoot, slow settle',    kp:1,  ki:0.1, kd:0.5, setpoint:5 },
      { id:'q-p4', name:'P-only',         desc:'Persistent oscillation (no D)',     kp:8,  ki:0,   kd:0,   setpoint:5 },
      { id:'q-p5', name:'High altitude',  desc:'15 m target, well damped',          kp:5,  ki:0.8, kd:3,   setpoint:15 },
    ],
    lqr: [
      { id:'q-l1', name:'Balanced',       desc:'Equal position & velocity weight',  q1:10,  q2:1, r:0.1,  setpoint:5 },
      { id:'q-l2', name:'Tight position', desc:'Prioritises position accuracy',     q1:100, q2:1, r:0.1,  setpoint:5 },
      { id:'q-l3', name:'Smooth thrust',  desc:'High R → gentle thrust',            q1:10,  q2:2, r:5,    setpoint:5 },
      { id:'q-l4', name:'No overshoot',   desc:'Heavy velocity penalty',            q1:20,  q2:20,r:0.5,  setpoint:5 },
    ],
  },
  f1tenth: {
    pid: [
      { id:'f-p1', name:'Smooth 3 m/s',  desc:'Gentle at medium speed',             f1TargetSpeed:3,   f1KpV:2,   f1KiV:0.5,  f1KdV:0.05, f1KpL:0.9, f1KiL:0,   f1KdL:0.15 },
      { id:'f-p2', name:'Fast 5 m/s',    desc:'Aggressive cornering at high speed', f1TargetSpeed:5,   f1KpV:2.5, f1KiV:0.5,  f1KdV:0.05, f1KpL:1.2, f1KiL:0,   f1KdL:0.2 },
      { id:'f-p3', name:'Crawl 1 m/s',   desc:'Very safe low-speed tuning',         f1TargetSpeed:1,   f1KpV:1.5, f1KiV:0.3,  f1KdV:0.02, f1KpL:0.6, f1KiL:0,   f1KdL:0.1 },
      { id:'f-p4', name:'Oscillating',   desc:'High lateral gain → weaving',        f1TargetSpeed:3,   f1KpV:2,   f1KiV:0.5,  f1KdV:0.05, f1KpL:3.0, f1KiL:0,   f1KdL:0 },
    ],
    lqr: [
      { id:'f-l1', name:'Balanced',      desc:'Good tracking at 3 m/s',             f1TargetSpeed:3,   f1Q1L:50,  f1Q2L:5,  f1RL:0.1  },
      { id:'f-l2', name:'Tight path',    desc:'Heavy CTE penalty',                  f1TargetSpeed:3,   f1Q1L:150, f1Q2L:5,  f1RL:0.1  },
      { id:'f-l3', name:'Soft steer',    desc:'High R — gentle steering',           f1TargetSpeed:3,   f1Q1L:50,  f1Q2L:5,  f1RL:2.0  },
      { id:'f-l4', name:'Fast LQR 5m/s', desc:'Optimised for high speed',           f1TargetSpeed:5,   f1Q1L:80,  f1Q2L:10, f1RL:0.05 },
    ],
  },
  pendulum: {
    pid: [
      { id:'pe-p1', name:'Stable PID',   desc:'Typical Kp/Kd for balance',         pendKp:35, pendKi:0, pendKd:6  },
      { id:'pe-p2', name:'Heavy D',      desc:'Very damped response',               pendKp:30, pendKi:0, pendKd:15 },
      { id:'pe-p3', name:'Underdamped',  desc:'Fast but oscillatory',               pendKp:50, pendKi:0, pendKd:2  },
      { id:'pe-p4', name:'Falls over',   desc:'Insufficient D — will fall',         pendKp:10, pendKi:0, pendKd:0  },
    ],
    lqr: [
      { id:'pe-l1', name:'Classic LQR',  desc:'Angle-dominant weights',             pendQ1:5,  pendQ2:1, pendQ3:120, pendQ4:12, pendR:0.05 },
      { id:'pe-l2', name:'Cart-center',  desc:'Heavy cart-pos penalty',             pendQ1:50, pendQ2:5, pendQ3:100, pendQ4:10, pendR:0.05 },
      { id:'pe-l3', name:'Aggressive',   desc:'Very high angle penalty',            pendQ1:1,  pendQ2:1, pendQ3:500, pendQ4:50, pendR:0.01 },
      { id:'pe-l4', name:'Soft force',   desc:'High R → smaller control effort',   pendQ1:5,  pendQ2:1, pendQ3:120, pendQ4:12, pendR:0.5 },
    ],
  },
}

function PresetCard({ preset, active, onLoad }) {
  return (
    <div style={{
      background: active ? '#0f2a4a' : '#161b22',
      border: `1px solid ${active ? '#4a90d9' : '#21262d'}`,
      borderRadius:8, padding:'8px 12px',
      display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:'#e6edf3', fontSize:13, fontWeight:600 }}>{preset.name}</div>
        <div style={{ color:'#6b7280', fontSize:11, marginTop:2 }}>{preset.desc}</div>
      </div>
      <button onClick={onLoad} style={{
        flexShrink:0, background: active ? '#1d4ed8' : '#21262d',
        border: `1px solid ${active ? '#4a90d9' : '#30363d'}`,
        borderRadius:5, color:'#e6edf3', fontSize:11, padding:'4px 10px',
        cursor:'pointer', marginTop:2,
      }}>{active ? '✓' : 'Load'}</button>
    </div>
  )
}

export default function PresetGallery() {
  const { vehicle, mode, applyPreset, setMode } = useSimStore()
  const [activeId, setActiveId] = useState(null)

  const vehiclePresets = PRESETS[vehicle] ?? {}
  const modePresets    = vehiclePresets[mode] ?? []

  function handleLoad(preset) {
    applyPreset(preset)
    setActiveId(preset.id)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Controller mode toggle within gallery */}
      <div style={{ display:'flex', gap:6 }}>
        {['pid','lqr'].map(m => (
          <button key={m} onClick={() => { setMode(m); setActiveId(null) }} style={{
            flex:1, padding:'6px 0',
            background: mode===m ? '#1d4ed8' : '#161b22',
            border: `1px solid ${mode===m ? '#4a90d9' : '#30363d'}`,
            borderRadius:6, color: mode===m ? '#fff' : '#6b7280',
            fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase',
          }}>{m}</button>
        ))}
      </div>

      {modePresets.length === 0 ? (
        <div style={{ color:'#4b5563', textAlign:'center', padding:'20px 0', fontSize:12 }}>
          No presets for this combination.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {modePresets.map(p => (
            <PresetCard key={p.id} preset={p} active={activeId===p.id} onLoad={() => handleLoad(p)} />
          ))}
        </div>
      )}

      <div style={{ color:'#374151', fontSize:11, textAlign:'center', paddingTop:4, borderTop:'1px solid #21262d' }}>
        Load a preset, then press <kbd style={kbd}>R</kbd> to simulate.
      </div>
    </div>
  )
}

const kbd = { background:'#161b22', border:'1px solid #30363d', borderRadius:4, padding:'1px 5px', fontFamily:'monospace', color:'#9ca3af', fontSize:10 }
