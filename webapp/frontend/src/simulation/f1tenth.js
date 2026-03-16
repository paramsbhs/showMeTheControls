/**
 * F1TENTH kinematic bicycle model — circular track following.
 *
 * State:   [x, y, ψ, v]   (position, heading, speed)
 * Inputs:  δ (steering), a (acceleration/throttle)
 *
 * Reference path: circle of radius TRACK_RADIUS centred at origin.
 * Lateral error = signed distance from circle surface (radial CTE).
 * Heading error = ψ − tangent direction at nearest point.
 *
 * Two controllers available:
 *   PID  — separate speed PID + lateral PID (CTE + heading blend)
 *   LQR  — speed PID + LQR on [CTE, heading_error] linearised at v₀
 */

import { solveDARE, computeK } from './dare.js'

const WHEELBASE    = 0.32   // m (F1TENTH scale 1:10)
const MAX_STEER    = 0.42   // rad (~24°)
const MAX_SPEED    = 7.0    // m/s
const TRACK_RADIUS = 8.0    // m

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function normalizeAngle(a) {
  while (a >  Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

function makePID(kp, ki, kd, intClamp = 3) {
  let integral = 0, prevErr = 0, init = false
  return {
    step(err, dt) {
      integral = clamp(integral + err * dt, -intClamp, intClamp)
      const deriv = init ? (err - prevErr) / dt : 0
      prevErr = err; init = true
      return kp * err + ki * integral + kd * deriv
    },
  }
}

function bikeStep(x, y, psi, v, delta, a, dt) {
  delta    = clamp(delta, -MAX_STEER, MAX_STEER)
  const nv = clamp(v + a * dt, 0, MAX_SPEED)
  const va = (v + nv) / 2
  return {
    x:   x   + va * Math.cos(psi) * dt,
    y:   y   + va * Math.sin(psi) * dt,
    psi: normalizeAngle(psi + (va / WHEELBASE) * Math.tan(delta) * dt),
    v:   nv,
  }
}

function trackErrors(x, y, psi) {
  const R   = TRACK_RADIUS
  const r   = Math.sqrt(x * x + y * y)
  const cte = r - R                             // + = outside, − = inside
  const phi = Math.atan2(y, x)
  const tangent = normalizeAngle(phi + Math.PI / 2) // CCW tangent direction
  return { cte, headingErr: normalizeAngle(psi - tangent) }
}

function downsample(pts, maxN) {
  if (pts.length <= maxN) return pts
  const out = [], step = (pts.length - 1) / (maxN - 1)
  for (let i = 0; i < maxN; i++) out.push(pts[Math.round(i * step)])
  return out
}

export function runF1TenthSimulation({
  mode,
  targetSpeed,
  kpV, kiV, kdV,    // speed PID
  kpL, kiL, kdL,    // lateral PID
  q1L, q2L, rL,     // lateral LQR
  duration,
}) {
  const dt    = 0.01
  const steps = Math.round(clamp(duration, 2, 30) / dt)

  const speedPID = makePID(kpV, kiV, kdV, 4)

  let K_lat = null
  let latPID = null

  if (mode === 'lqr') {
    const v0 = Math.max(0.5, targetSpeed)
    const L  = WHEELBASE
    // Linearised lateral dynamics around circular equilibrium: state=[CTE, ψ_err], input=[δ]
    // d(CTE)/dt = -v·ψ_err  (car heading MORE inward → CTE DECREASES)
    // d(ψ_err)/dt = (v/L)·δ − v/R  (steering + natural curvature correction)
    const Ad = [[1, -v0 * dt], [0, 1]]
    const Bd = [[-0.5 * v0 * v0 * dt * dt / L], [v0 * dt / L]]
    const Q  = [[q1L, 0], [0, q2L]]
    const R  = [[rL]]
    const P  = solveDARE(Ad, Bd, Q, R)
    const K  = computeK(Ad, Bd, P, R)   // 1×2
    K_lat    = [K[0][0], K[0][1]]
  } else {
    latPID = makePID(kpL, kiL, kdL, 0.5)
  }

  // Start at (R, 0), heading north (CCW)
  let x = TRACK_RADIUS, y = 0, psi = Math.PI / 2, v = 0
  let prevPhi = Math.PI / 2
  let lapCount = 0
  let maxCTE = 0, sumSqCTE = 0
  let settlingStart = -1, settlingTime = duration
  const points = []

  for (let i = 0; i < steps; i++) {
    const t                    = i * dt
    const { cte, headingErr }  = trackErrors(x, y, psi)
    const phi                  = Math.atan2(y, x)

    // Count CCW laps (crossing positive x-axis upward)
    if (prevPhi < 0 && phi >= 0 && t > 1) lapCount++
    prevPhi = phi

    // Speed PID → throttle
    const a = clamp(speedPID.step(targetSpeed - v, dt), -4, 3)

    // Lateral controller → steering
    // Sign convention: cte > 0 = outside track (CCW); correction needs left turn (delta > 0)
    let delta = 0
    if (mode === 'lqr') {
      // Feedforward for circular curvature + LQR feedback
      const ff = WHEELBASE / TRACK_RADIUS
      delta = clamp(ff - (K_lat[0] * cte + K_lat[1] * headingErr), -MAX_STEER, MAX_STEER)
    } else {
      // -cte: outside → negative combined → pid_out negative → delta = -pid_out = positive (left) ✓
      const combined = -cte + Math.sin(headingErr) * WHEELBASE
      delta = clamp(-latPID.step(combined, dt), -MAX_STEER, MAX_STEER)
    }

    points.push({ t, x, y, psi, v, cte, headingErr, steering: delta, throttle: a, lap: lapCount })

    if (Math.abs(cte) > maxCTE) maxCTE = Math.abs(cte)
    sumSqCTE += cte * cte

    if (Math.abs(cte) < 0.1 && t > 1) {
      if (settlingStart < 0) settlingStart = t
    } else if (t > 1) {
      settlingStart = -1; settlingTime = duration
    }
    if (settlingStart >= 0 && settlingTime === duration) settlingTime = settlingStart

    const next = bikeStep(x, y, psi, v, delta, a, dt)
    x = next.x; y = next.y; psi = next.psi; v = next.v
  }

  return {
    points: downsample(points, 600),
    metrics: {
      settlingTime,
      overshoot:   maxCTE,
      rmsError:    Math.sqrt(sumSqCTE / steps),
      steadyState: Math.abs(points[points.length - 1]?.cte ?? 0),
      lapCount,
      finalSpeed:  points[points.length - 1]?.v ?? 0,
    },
    gains: K_lat ? { K: K_lat } : null,
  }
}
