import { Canvas } from '@react-three/fiber'
import { useSimStore } from '../store/useSimStore'
import QuadcopterScene from './vehicles/QuadcopterScene'
import F1TenthScene    from './vehicles/F1TenthScene'
import PendulumScene   from './vehicles/PendulumScene'

const SCENE_CONFIG = {
  quadcopter: {
    camera:     { position: [4, 4, 4], fov: 50 },
    background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 100%)',
  },
  f1tenth: {
    // track radius=8m → need to see ~18m diameter; high angle overhead view
    camera:     { position: [0, 20, 8], fov: 65 },
    background: 'linear-gradient(180deg, #030a03 0%, #0a1a0a 100%)',
  },
  pendulum: {
    // front view: cart travels ±2.5m, pole ~1.3m tall
    camera:     { position: [0, 1.5, 10], fov: 55 },
    background: 'linear-gradient(180deg, #0a0a0a 0%, #0d1117 100%)',
  },
}

function Hud({ vehicle, points, playhead, setpoint, targetSpeed }) {
  const pt = points[Math.min(playhead, points.length - 1)]

  const rows = {
    quadcopter: pt ? [
      { label: 'ALT', value: `${pt.z?.toFixed(2)} m`,   accent: false },
      { label: 'TGT', value: `${setpoint?.toFixed(2)} m`, accent: true },
      { label: 'ERR', value: `${pt.error?.toFixed(3)} m`, ok: Math.abs(pt.error) < 0.1 },
    ] : [],
    f1tenth: pt ? [
      { label: 'SPD',  value: `${(pt.v ?? 0).toFixed(2)} m/s`,   accent: false },
      { label: 'TGT',  value: `${targetSpeed?.toFixed(1)} m/s`,   accent: true },
      { label: 'CTE',  value: `${(pt.cte ?? 0).toFixed(3)} m`,    ok: Math.abs(pt.cte) < 0.1 },
      { label: 'LAP',  value: `${pt.lap ?? 0}`,                   accent: false },
    ] : [],
    pendulum: pt ? [
      { label: 'θ',    value: `${((pt.theta ?? 0)*180/Math.PI).toFixed(1)}°`, ok: Math.abs(pt.theta) < 0.05 },
      { label: 'x',    value: `${(pt.x ?? 0).toFixed(3)} m`,   accent: false },
      { label: 'F',    value: `${(pt.force ?? 0).toFixed(1)} N`, accent: false },
    ] : [],
  }[vehicle] ?? []

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12,
      color: '#7ec8e3', fontFamily: 'monospace', fontSize: 12,
      background: 'rgba(0,0,0,0.55)', padding: '6px 10px', borderRadius: 6,
      borderLeft: '2px solid #4a90d9', pointerEvents: 'none',
    }}>
      {rows.map(({ label, value, accent, ok }) => (
        <div key={label}>
          {label}:{' '}
          <span style={{ color: ok !== undefined ? (ok ? '#00ff88' : '#ffcc00') : accent ? '#ff6b35' : '#fff' }}>
            {value}
          </span>
        </div>
      ))}
      {vehicle === 'pendulum' && points[playhead]?.theta > 0.9*Math.PI && (
        <div style={{ color: '#ef4444', marginTop: 4 }}>FALLEN</div>
      )}
    </div>
  )
}

export default function SimCanvas() {
  const { vehicle, points, playhead, setpoint, f1TargetSpeed, followCam, toggleFollowCam } = useSimStore()
  const cfg = SCENE_CONFIG[vehicle] ?? SCENE_CONFIG.quadcopter

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas key={vehicle} camera={cfg.camera} style={{ background: cfg.background }}>
        {vehicle === 'quadcopter' && (
          <QuadcopterScene points={points} playhead={playhead} setpoint={setpoint} followCam={followCam} />
        )}
        {vehicle === 'f1tenth' && (
          <F1TenthScene points={points} playhead={playhead} followCam={followCam} />
        )}
        {vehicle === 'pendulum' && (
          <PendulumScene points={points} playhead={playhead} followCam={followCam} />
        )}
      </Canvas>

      <Hud
        vehicle={vehicle}
        points={points}
        playhead={playhead}
        setpoint={setpoint}
        targetSpeed={f1TargetSpeed}
      />

      {/* Follow-cam toggle */}
      <button
        onClick={toggleFollowCam}
        title={followCam ? 'Switch to free camera' : 'Switch to follow camera'}
        style={{
          position: 'absolute', bottom: 12, right: 12,
          background: followCam ? 'rgba(74,144,217,0.25)' : 'rgba(0,0,0,0.55)',
          border: `1px solid ${followCam ? '#4a90d9' : '#30363d'}`,
          borderRadius: 6, color: followCam ? '#4a90d9' : '#6b7280',
          fontSize: 11, fontWeight: 600, padding: '5px 10px',
          cursor: 'pointer', fontFamily: 'monospace',
        }}
      >
        {followCam ? '📷 Follow' : '🔭 Free'}
      </button>
    </div>
  )
}
