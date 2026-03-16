import { useState } from 'react'
import { useSimStore } from '../store/useSimStore'

function Tile({ label, value, unit, good, bad, format = v => v.toFixed(3) }) {
  const color = good !== undefined
    ? (value <= good ? '#5fa882' : value <= bad ? '#c4a055' : '#c47d7d')
    : '#e0e0e0'
  return (
    <div style={{ background:'#1a1a1a', border:'1px solid #2e2e2e', borderRadius:8, padding:'9px 12px' }}>
      <div style={{ color:'#999999', fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</div>
      <div style={{ color, fontSize:19, fontFamily:'monospace', fontWeight:700, marginTop:2 }}>
        {format(value)}<span style={{ fontSize:10, color:'#999999', marginLeft:3 }}>{unit}</span>
      </div>
    </div>
  )
}

function score(m) {
  let s = 100
  s -= Math.min(m.settlingTime * 4, 40)
  s -= Math.min(m.overshoot * 0.8, 30)
  s -= Math.min(m.rmsError * 40, 20)
  s -= Math.min(m.steadyState * 50, 10)
  return Math.max(0, Math.round(s))
}

function ScoreBadge({ metrics }) {
  const s = score(metrics)
  const color = s >= 80 ? '#5fa882' : s >= 50 ? '#c4a055' : '#c47d7d'
  return (
    <div style={{ background:'#1a1a1a', border:`1px solid ${color}33`, borderRadius:8, padding:'9px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <div>
        <div style={{ color:'#aaaaaa', fontSize:11 }}>Tuning Score</div>
        <div style={{ color, fontSize:10, marginTop:1 }}>{s >= 80 ? 'Well tuned' : s >= 50 ? 'Acceptable' : 'Needs work'}</div>
      </div>
      <span style={{ color, fontFamily:'monospace', fontSize:26, fontWeight:800 }}>{s}<span style={{ fontSize:11, color:'#999999' }}>/100</span></span>
    </div>
  )
}

function ExportBox({ code, lang }) {
  const [copied, setCopied] = useState(false)
  function copy() { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ color:'#999999', fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em' }}>Export ({lang})</span>
        <button onClick={copy} style={{
          background: copied ? '#14532d' : '#2e2e2e',
          border: `1px solid ${copied ? '#16a34a' : '#383838'}`,
          borderRadius:4, color: copied ? '#4ade80' : '#aaaaaa',
          fontSize:11, padding:'2px 8px', cursor:'pointer', transition:'all 0.2s',
        }}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
      <pre style={{ background:'#111111', border:'1px solid #2e2e2e', borderRadius:6, padding:'9px 12px', color:'#7ee787', fontSize:10, fontFamily:'monospace', margin:0, overflowX:'auto', whiteSpace:'pre' }}>
        {code}
      </pre>
    </div>
  )
}

// ─── Vehicle metric sets ──────────────────────────────────────────────────────

function QuadMetrics({ m }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
      <Tile label='Settling'     value={m.settlingTime} unit='s'  format={v=>v.toFixed(2)} good={2}    bad={5} />
      <Tile label='Overshoot'    value={m.overshoot}    unit='%'  format={v=>v.toFixed(1)} good={5}    bad={20} />
      <Tile label='RMS Error'    value={m.rmsError}     unit='m'  format={v=>v.toFixed(3)} good={0.1}  bad={0.5} />
      <Tile label='Steady State' value={m.steadyState}  unit='m'  format={v=>v.toFixed(3)} good={0.02} bad={0.1} />
    </div>
  )
}

function F1Metrics({ m }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
      <Tile label='Settling CTE' value={m.settlingTime} unit='s'  format={v=>v.toFixed(2)} good={3}   bad={8} />
      <Tile label='Max CTE'      value={m.overshoot}    unit='m'  format={v=>v.toFixed(3)} good={0.2} bad={0.5} />
      <Tile label='RMS CTE'      value={m.rmsError}     unit='m'  format={v=>v.toFixed(3)} good={0.1} bad={0.3} />
      <Tile label='Laps done'    value={m.lapCount ?? 0} unit=''  format={v=>v.toFixed(0)} />
    </div>
  )
}

function PendulumMetrics({ m }) {
  return (
    <>
      {m.fallen && (
        <div style={{ background:'#7f1d1d', border:'1px solid #ef4444', borderRadius:8, padding:'8px 12px', marginBottom:8, color:'#fca5a5', fontSize:12, fontWeight:600 }}>
          ⚠ Pendulum fell over — tune gains and try again
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
        <Tile label='Settling'     value={m.settlingTime} unit='s'   format={v=>v.toFixed(2)} good={2}  bad={6} />
        <Tile label='Extra swing'  value={m.overshoot}    unit='°'   format={v=>v.toFixed(1)} good={5}  bad={20} />
        <Tile label='RMS θ'        value={m.rmsError}     unit='°'   format={v=>v.toFixed(2)} good={5}  bad={20} />
        <Tile label='Final θ'      value={m.steadyState}  unit='°'   format={v=>v.toFixed(2)} good={1}  bad={5} />
      </div>
    </>
  )
}

// ─── Export code generators ───────────────────────────────────────────────────

function buildExport(vehicle, mode, s) {
  if (vehicle === 'quadcopter') {
    if (mode === 'pid') return {
      lang: 'ROS 2 YAML',
      code: `# ROS 2 pid_controller\npid_controller:\n  ros__parameters:\n    p: ${s.kp.toFixed(4)}\n    i: ${s.ki.toFixed(4)}\n    d: ${s.kd.toFixed(4)}`,
    }
    return {
      lang: 'Python',
      code: s.gains ? `# LQR quadcopter vertical\nK = [${s.gains.K[0].toFixed(6)}, ${s.gains.K[1].toFixed(6)}]\n# u = K[0]*(sp-z) + K[1]*(0-vz)\n# Q=diag(${s.q1},${s.q2})  R=${s.r}` : '# run simulation first',
    }
  }
  if (vehicle === 'f1tenth') {
    if (mode === 'pid') return {
      lang: 'ROS 2 YAML',
      code: `# F1TENTH speed + lateral PID\nspeed_pid:  {p: ${s.f1KpV}, i: ${s.f1KiV}, d: ${s.f1KdV}}\nlateral_pid: {p: ${s.f1KpL}, i: ${s.f1KiL}, d: ${s.f1KdL}}\ntarget_speed: ${s.f1TargetSpeed}`,
    }
    return {
      lang: 'Python',
      code: s.gains ? `# F1TENTH lateral LQR\nK_lat = [${s.gains.K[0].toFixed(6)}, ${s.gains.K[1].toFixed(6)}]\n# delta = -(K_lat[0]*cte + K_lat[1]*heading_err)\n# Speed PID: Kp=${s.f1KpV} Ki=${s.f1KiV} Kd=${s.f1KdV}` : '# run simulation first',
    }
  }
  if (vehicle === 'pendulum') {
    if (mode === 'pid') return {
      lang: 'Python',
      code: `# Cart-pole PID (angle only)\nKp = ${s.pendKp}  Ki = ${s.pendKi}  Kd = ${s.pendKd}\n# F = pid(-theta) - 0.5*x - 0.3*xdot`,
    }
    return {
      lang: 'Python',
      code: s.gains ? `# Cart-pole LQR  state=[x, xdot, theta, thetadot]\nK = [${s.gains.K.map(k=>k.toFixed(4)).join(', ')}]\n# F = -(K[0]*x + K[1]*xd + K[2]*th + K[3]*thd)\n# Q=diag(${s.pendQ1},${s.pendQ2},${s.pendQ3},${s.pendQ4})  R=${s.pendR}` : '# run simulation first',
    }
  }
  return { lang: 'code', code: '# unknown vehicle' }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MetricsPanel() {
  const s = useSimStore()
  const { metrics, vehicle, mode, gains } = s

  if (!metrics) return (
    <div style={{ color:'#999999', textAlign:'center', paddingTop:40, fontSize:14 }}>No metrics yet — run a simulation.</div>
  )

  const { lang, code } = buildExport(vehicle, mode, { ...s, gains })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <h3 style={{ color:'#cccccc', fontSize:11, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', margin:0 }}>Performance</h3>
      {vehicle === 'quadcopter' && <QuadMetrics    m={metrics} />}
      {vehicle === 'f1tenth'    && <F1Metrics      m={metrics} />}
      {vehicle === 'pendulum'   && <PendulumMetrics m={metrics} />}
      {vehicle !== 'pendulum' && <ScoreBadge metrics={metrics} />}
      <ExportBox code={code} lang={lang} />
    </div>
  )
}
