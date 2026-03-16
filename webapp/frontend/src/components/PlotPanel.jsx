import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { useSimStore } from '../store/useSimStore'

const TT  = { background:'#161b22', border:'1px solid #30363d', borderRadius:6, color:'#e6edf3', fontSize:12 }
const fmt = v => typeof v === 'number' ? v.toFixed(3) : v
const tlFmt = l => `t=${typeof l==='number'?l.toFixed(2):l}s`

function Chart({ title, height = 160, children, data }) {
  return (
    <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:8, padding:'10px 8px 6px', marginBottom:10 }}>
      {title && <div style={{ color:'#9ca3af', fontSize:11, marginBottom:6, paddingLeft:8 }}>{title}</div>}
      <ResponsiveContainer width='100%' height={height}>
        <LineChart data={data} margin={{ top:2, right:14, bottom:2, left:0 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#21262d' />
          <XAxis dataKey='t' stroke='#4b5563' tick={{ fontSize:10 }} tickFormatter={v => v.toFixed(1)} />
          <YAxis stroke='#4b5563' tick={{ fontSize:10 }} width={38} />
          <Tooltip contentStyle={TT} formatter={(v,n) => [fmt(v),n]} labelFormatter={tlFmt} />
          <Legend wrapperStyle={{ fontSize:10 }} />
          {children}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Vehicle-specific plot sets ───────────────────────────────────────────────

function QuadTimePlots({ visible, setpoint }) {
  return (
    <>
      <Chart title='Altitude (m)' height={170} data={visible}>
        <ReferenceLine y={setpoint} stroke='#ff6b35' strokeDasharray='4 3'
          label={{ value:'target', fill:'#ff6b35', fontSize:9 }} />
        <Line type='monotone' dataKey='z' stroke='#4a90d9' dot={false} strokeWidth={2} name='altitude' isAnimationActive={false} />
      </Chart>
      <Chart title='Error (m)' height={130} data={visible}>
        <ReferenceLine y={0} stroke='#374151' />
        <Line type='monotone' dataKey='error' stroke='#f59e0b' dot={false} strokeWidth={1.5} name='error' isAnimationActive={false} />
      </Chart>
      <Chart title='Velocity (m/s) & Thrust (N)' height={130} data={visible}>
        <Line type='monotone' dataKey='vz'     stroke='#a78bfa' dot={false} strokeWidth={1.5} name='velocity' isAnimationActive={false} />
        <Line type='monotone' dataKey='thrust' stroke='#34d399' dot={false} strokeWidth={1.5} name='thrust'   isAnimationActive={false} />
      </Chart>
    </>
  )
}

function QuadPhase({ points, playhead }) {
  const data = useMemo(() => {
    const out = []
    for (let i = 1; i < points.length; i++) {
      const dt = points[i].t - points[i-1].t
      if (dt <= 0) continue
      out.push({ error: points[i].error, errorRate: (points[i].error - points[i-1].error) / dt })
    }
    return out
  }, [points])
  const visible = data.slice(0, Math.max(0, playhead))
  const cur = visible[visible.length - 1]
  return (
    <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:8, padding:'10px 8px 6px' }}>
      <div style={{ color:'#9ca3af', fontSize:11, marginBottom:6, paddingLeft:8 }}>Phase Portrait (error vs ė)</div>
      <ResponsiveContainer width='100%' height={210}>
        <ScatterChart margin={{ top:4, right:14, bottom:18, left:0 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#21262d' />
          <XAxis type='number' dataKey='error'     stroke='#4b5563' tick={{ fontSize:10 }}
            label={{ value:'error (m)', fill:'#6b7280', fontSize:9, position:'insideBottom', offset:-10 }} />
          <YAxis type='number' dataKey='errorRate' stroke='#4b5563' tick={{ fontSize:10 }} width={42}
            label={{ value:'ė (m/s)', fill:'#6b7280', fontSize:9, angle:-90, position:'insideLeft' }} />
          <ZAxis range={[6,6]} />
          <Tooltip contentStyle={TT} formatter={(v,n) => [fmt(v),n]} />
          <ReferenceLine x={0} stroke='#374151' />
          <ReferenceLine y={0} stroke='#374151' />
          <Scatter data={data}    fill='#4a90d9' opacity={0.15} />
          <Scatter data={visible} fill='#4a90d9' opacity={0.65} />
          {cur && <Scatter data={[cur]} fill='#ff6b35' opacity={1} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function F1Plots({ visible, targetSpeed }) {
  // XY trajectory
  const allXY = useMemo(() => visible.map(p => ({ x: p.x, y: p.y })), [visible])
  return (
    <>
      <Chart title='Cross-track error (m)' height={140} data={visible}>
        <ReferenceLine y={0} stroke='#374151' />
        <ReferenceLine y={0.1}  stroke='#f59e0b' strokeDasharray='4 3' />
        <ReferenceLine y={-0.1} stroke='#f59e0b' strokeDasharray='4 3' />
        <Line type='monotone' dataKey='cte' stroke='#f59e0b' dot={false} strokeWidth={1.5} name='CTE' isAnimationActive={false} />
      </Chart>
      <Chart title='Speed (m/s)' height={130} data={visible}>
        <ReferenceLine y={targetSpeed} stroke='#ff6b35' strokeDasharray='4 3'
          label={{ value:'target', fill:'#ff6b35', fontSize:9 }} />
        <Line type='monotone' dataKey='v' stroke='#4a90d9' dot={false} strokeWidth={2} name='speed' isAnimationActive={false} />
      </Chart>
      <Chart title='Steering (rad) & Heading err (rad)' height={130} data={visible}>
        <Line type='monotone' dataKey='steering'   stroke='#a78bfa' dot={false} strokeWidth={1.5} name='steering'    isAnimationActive={false} />
        <Line type='monotone' dataKey='headingErr' stroke='#34d399' dot={false} strokeWidth={1.5} name='heading err' isAnimationActive={false} />
      </Chart>
      {/* XY trajectory */}
      <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:8, padding:'10px 8px 6px' }}>
        <div style={{ color:'#9ca3af', fontSize:11, marginBottom:6, paddingLeft:8 }}>Track trajectory (top-down)</div>
        <ResponsiveContainer width='100%' height={200}>
          <ScatterChart margin={{ top:4, right:14, bottom:4, left:0 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#21262d' />
            <XAxis type='number' dataKey='x' stroke='#4b5563' tick={{ fontSize:10 }}
              domain={[-12, 12]} label={{ value:'x (m)', fill:'#6b7280', fontSize:9, position:'insideBottom', offset:-6 }} />
            <YAxis type='number' dataKey='y' stroke='#4b5563' tick={{ fontSize:10 }} width={38}
              domain={[-12, 12]} />
            <ZAxis range={[6,6]} />
            <Tooltip contentStyle={TT} formatter={(v,n) => [fmt(v),n]} />
            <Scatter data={allXY} fill='#4a90d9' opacity={0.7} name='path' />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

function PendulumPlots({ visible }) {
  const thetaDeg = visible.map(p => ({ ...p, thetaDeg: (p.theta ?? 0) * 180/Math.PI }))
  return (
    <>
      <Chart title='Pole angle θ (°)' height={160} data={thetaDeg}>
        <ReferenceLine y={0} stroke='#374151' />
        <ReferenceLine y={5}  stroke='#f59e0b' strokeDasharray='4 3' />
        <ReferenceLine y={-5} stroke='#f59e0b' strokeDasharray='4 3' />
        <Line type='monotone' dataKey='thetaDeg' stroke='#f59e0b' dot={false} strokeWidth={2} name='θ (°)' isAnimationActive={false} />
      </Chart>
      <Chart title='Cart position (m)' height={130} data={visible}>
        <ReferenceLine y={0}    stroke='#374151' />
        <ReferenceLine y={2.5}  stroke='#ef4444' strokeDasharray='4 3' />
        <ReferenceLine y={-2.5} stroke='#ef4444' strokeDasharray='4 3' />
        <Line type='monotone' dataKey='x' stroke='#4a90d9' dot={false} strokeWidth={1.5} name='cart x' isAnimationActive={false} />
      </Chart>
      <Chart title='Angular velocity θ̇ (rad/s) & Force (N)' height={130} data={visible}>
        <Line type='monotone' dataKey='theta_dot' stroke='#a78bfa' dot={false} strokeWidth={1.5} name='θ̇'     isAnimationActive={false} />
        <Line type='monotone' dataKey='force'     stroke='#34d399' dot={false} strokeWidth={1.5} name='force' isAnimationActive={false} />
      </Chart>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PlotPanel() {
  const { points, playhead, vehicle, setpoint, f1TargetSpeed } = useSimStore()
  const [tab, setTab] = useState('time')

  if (!points.length) {
    return <div style={{ color:'#6b7280', textAlign:'center', paddingTop:40, fontSize:14 }}>Run a simulation to see plots.</div>
  }

  const visible = points.slice(0, playhead + 1)
  const showPhase = vehicle === 'quadcopter'

  return (
    <div>
      {showPhase && (
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {['time','phase'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'5px 0',
              background: tab===t ? '#1d4ed8' : '#161b22',
              border: `1px solid ${tab===t ? '#4a90d9' : '#30363d'}`,
              borderRadius:6, color: tab===t ? '#fff' : '#6b7280',
              fontSize:11, cursor:'pointer', fontWeight: tab===t ? 600 : 400,
            }}>{t === 'time' ? 'Time Series' : 'Phase Portrait'}</button>
          ))}
        </div>
      )}

      {vehicle === 'quadcopter' && (
        tab === 'time'
          ? <QuadTimePlots visible={visible} setpoint={setpoint} />
          : <QuadPhase     points={points}   playhead={playhead} />
      )}
      {vehicle === 'f1tenth'    && <F1Plots       visible={visible} targetSpeed={f1TargetSpeed} />}
      {vehicle === 'pendulum'   && <PendulumPlots visible={visible} />}
    </div>
  )
}
