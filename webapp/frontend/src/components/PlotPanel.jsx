import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { useSimStore } from '../store/useSimStore'

const TT  = { background:'#222222', border:'1px solid #383838', borderRadius:6, color:'#e0e0e0', fontSize:12 }
const fmt = v => typeof v === 'number' ? v.toFixed(3) : v
const tlFmt = l => `t=${typeof l==='number'?l.toFixed(2):l}s`

function Chart({ title, height = 160, children, data }) {
  return (
    <div style={{ background:'#1a1a1a', border:'1px solid #2e2e2e', borderRadius:8, padding:'10px 8px 6px', marginBottom:10 }}>
      {title && <div style={{ color:'#aaaaaa', fontSize:11, marginBottom:6, paddingLeft:8 }}>{title}</div>}
      <ResponsiveContainer width='100%' height={height}>
        <LineChart data={data} margin={{ top:2, right:14, bottom:2, left:0 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#2e2e2e' />
          <XAxis dataKey='t' stroke='#555555' tick={{ fontSize:10 }} tickFormatter={v => v.toFixed(1)} />
          <YAxis stroke='#555555' tick={{ fontSize:10 }} width={38} />
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
        <ReferenceLine y={setpoint} stroke='#c4835a' strokeDasharray='4 3'
          label={{ value:'target', fill:'#c4835a', fontSize:9 }} />
        <Line type='monotone' dataKey='z' stroke='#7da8c4' dot={false} strokeWidth={2} name='altitude' isAnimationActive={false} />
      </Chart>
      <Chart title='Error (m)' height={130} data={visible}>
        <ReferenceLine y={0} stroke='#444444' />
        <Line type='monotone' dataKey='error' stroke='#c4a055' dot={false} strokeWidth={1.5} name='error' isAnimationActive={false} />
      </Chart>
      <Chart title='Velocity (m/s) & Thrust (N)' height={130} data={visible}>
        <Line type='monotone' dataKey='vz'     stroke='#9b8ec4' dot={false} strokeWidth={1.5} name='velocity' isAnimationActive={false} />
        <Line type='monotone' dataKey='thrust' stroke='#5fa882' dot={false} strokeWidth={1.5} name='thrust'   isAnimationActive={false} />
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
    <div style={{ background:'#1a1a1a', border:'1px solid #2e2e2e', borderRadius:8, padding:'10px 8px 6px' }}>
      <div style={{ color:'#aaaaaa', fontSize:11, marginBottom:6, paddingLeft:8 }}>Phase Portrait (error vs ė)</div>
      <ResponsiveContainer width='100%' height={210}>
        <ScatterChart margin={{ top:4, right:14, bottom:18, left:0 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='#2e2e2e' />
          <XAxis type='number' dataKey='error'     stroke='#555555' tick={{ fontSize:10 }}
            label={{ value:'error (m)', fill:'#999999', fontSize:9, position:'insideBottom', offset:-10 }} />
          <YAxis type='number' dataKey='errorRate' stroke='#555555' tick={{ fontSize:10 }} width={42}
            label={{ value:'ė (m/s)', fill:'#999999', fontSize:9, angle:-90, position:'insideLeft' }} />
          <ZAxis range={[6,6]} />
          <Tooltip contentStyle={TT} formatter={(v,n) => [fmt(v),n]} />
          <ReferenceLine x={0} stroke='#444444' />
          <ReferenceLine y={0} stroke='#444444' />
          <Scatter data={data}    fill='#7da8c4' opacity={0.15} />
          <Scatter data={visible} fill='#7da8c4' opacity={0.65} />
          {cur && <Scatter data={[cur]} fill='#c4835a' opacity={1} />}
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
        <ReferenceLine y={0} stroke='#444444' />
        <ReferenceLine y={0.1}  stroke='#c4a055' strokeDasharray='4 3' />
        <ReferenceLine y={-0.1} stroke='#c4a055' strokeDasharray='4 3' />
        <Line type='monotone' dataKey='cte' stroke='#c4a055' dot={false} strokeWidth={1.5} name='CTE' isAnimationActive={false} />
      </Chart>
      <Chart title='Speed (m/s)' height={130} data={visible}>
        <ReferenceLine y={targetSpeed} stroke='#c4835a' strokeDasharray='4 3'
          label={{ value:'target', fill:'#c4835a', fontSize:9 }} />
        <Line type='monotone' dataKey='v' stroke='#7da8c4' dot={false} strokeWidth={2} name='speed' isAnimationActive={false} />
      </Chart>
      <Chart title='Steering (rad) & Heading err (rad)' height={130} data={visible}>
        <Line type='monotone' dataKey='steering'   stroke='#9b8ec4' dot={false} strokeWidth={1.5} name='steering'    isAnimationActive={false} />
        <Line type='monotone' dataKey='headingErr' stroke='#5fa882' dot={false} strokeWidth={1.5} name='heading err' isAnimationActive={false} />
      </Chart>
      {/* XY trajectory */}
      <div style={{ background:'#1a1a1a', border:'1px solid #2e2e2e', borderRadius:8, padding:'10px 8px 6px' }}>
        <div style={{ color:'#aaaaaa', fontSize:11, marginBottom:6, paddingLeft:8 }}>Track trajectory (top-down)</div>
        <ResponsiveContainer width='100%' height={200}>
          <ScatterChart margin={{ top:4, right:14, bottom:4, left:0 }}>
            <CartesianGrid strokeDasharray='3 3' stroke='#2e2e2e' />
            <XAxis type='number' dataKey='x' stroke='#555555' tick={{ fontSize:10 }}
              domain={[-12, 12]} label={{ value:'x (m)', fill:'#999999', fontSize:9, position:'insideBottom', offset:-6 }} />
            <YAxis type='number' dataKey='y' stroke='#555555' tick={{ fontSize:10 }} width={38}
              domain={[-12, 12]} />
            <ZAxis range={[6,6]} />
            <Tooltip contentStyle={TT} formatter={(v,n) => [fmt(v),n]} />
            <Scatter data={allXY} fill='#7da8c4' opacity={0.7} name='path' />
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
        <ReferenceLine y={0} stroke='#444444' />
        <ReferenceLine y={5}  stroke='#c4a055' strokeDasharray='4 3' />
        <ReferenceLine y={-5} stroke='#c4a055' strokeDasharray='4 3' />
        <Line type='monotone' dataKey='thetaDeg' stroke='#c4a055' dot={false} strokeWidth={2} name='θ (°)' isAnimationActive={false} />
      </Chart>
      <Chart title='Cart position (m)' height={130} data={visible}>
        <ReferenceLine y={0}    stroke='#444444' />
        <ReferenceLine y={2.5}  stroke='#ef4444' strokeDasharray='4 3' />
        <ReferenceLine y={-2.5} stroke='#ef4444' strokeDasharray='4 3' />
        <Line type='monotone' dataKey='x' stroke='#7da8c4' dot={false} strokeWidth={1.5} name='cart x' isAnimationActive={false} />
      </Chart>
      <Chart title='Angular velocity θ̇ (rad/s) & Force (N)' height={130} data={visible}>
        <Line type='monotone' dataKey='theta_dot' stroke='#9b8ec4' dot={false} strokeWidth={1.5} name='θ̇'     isAnimationActive={false} />
        <Line type='monotone' dataKey='force'     stroke='#5fa882' dot={false} strokeWidth={1.5} name='force' isAnimationActive={false} />
      </Chart>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PlotPanel() {
  const { points, playhead, vehicle, setpoint, f1TargetSpeed } = useSimStore()
  const [tab, setTab] = useState('time')

  if (!points.length) {
    return <div style={{ color:'#999999', textAlign:'center', paddingTop:40, fontSize:14 }}>Run a simulation to see plots.</div>
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
              background: tab===t ? '#2e2e2e' : '#222222',
              border: `1px solid ${tab===t ? '#cccccc' : '#383838'}`,
              borderRadius:6, color: tab===t ? '#fff' : '#999999',
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
