/**
 * Cart-pole inverted pendulum.
 *
 * State:   [x, ẋ, θ, θ̇]   (cart pos, cart vel, pole angle, pole ang-vel)
 * θ = 0   → upright (unstable equilibrium we want to balance at)
 * θ = π   → hanging down
 *
 * Full nonlinear dynamics via Euler-Lagrange, integrated with RK4.
 *
 * Controllers:
 *   LQR  — 4-state regulator linearised around upright (natural choice)
 *   PID  — PID on θ only, with heuristic cart-centering term
 */

import { solveDARE, computeK } from './dare.js'

const M_CART  = 1.0   // kg
const M_POLE  = 0.1   // kg
const L_HALF  = 0.5   // m (half-length of pole)
const G       = 9.81  // m/s²
const F_MAX   = 20.0  // N
const X_LIMIT = 2.5   // m (rail half-length)

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ─── Nonlinear equations of motion ─────────────────────────────────────────

function deriv(x, xd, th, thd, F) {
  const s   = Math.sin(th), c = Math.cos(th)
  const ml  = M_POLE * L_HALF
  // Correct Euler-Lagrange denominator: L·(M + m·sin²θ)
  const D    = M_CART + M_POLE * s * s
  const thdd = ((M_CART + M_POLE) * G * s - c * (F + ml * thd * thd * s))
             / (L_HALF * D)
  const xdd  = (F + ml * (thd * thd * s - thdd * c)) / (M_CART + M_POLE)
  return { dx: xd, dxd: xdd, dth: thd, dthd: thdd }
}

function rk4Step(x, xd, th, thd, F, dt) {
  const k1 = deriv(x,              xd,              th,              thd,              F)
  const k2 = deriv(x+k1.dx*dt/2,  xd+k1.dxd*dt/2, th+k1.dth*dt/2, thd+k1.dthd*dt/2, F)
  const k3 = deriv(x+k2.dx*dt/2,  xd+k2.dxd*dt/2, th+k2.dth*dt/2, thd+k2.dthd*dt/2, F)
  const k4 = deriv(x+k3.dx*dt,    xd+k3.dxd*dt,   th+k3.dth*dt,   thd+k3.dthd*dt,   F)
  return {
    x:   x   + dt/6*(k1.dx  +2*k2.dx  +2*k3.dx  +k4.dx),
    xd:  xd  + dt/6*(k1.dxd +2*k2.dxd +2*k3.dxd +k4.dxd),
    th:  th  + dt/6*(k1.dth +2*k2.dth +2*k3.dth +k4.dth),
    thd: thd + dt/6*(k1.dthd+2*k2.dthd+2*k3.dthd+k4.dthd),
  }
}

// ─── LQR gain computation ───────────────────────────────────────────────────

export function computePendulumLQRGains(q1, q2, q3, q4, r, dt = 0.01) {
  const m = M_POLE, M = M_CART, L = L_HALF, g = G

  // Continuous-time linearisation around θ=0:
  // ẋ = A x + B u
  const Ac = [
    [0, 1,              0,           0],
    [0, 0, -(m * g) / M,             0],
    [0, 0,              0,           1],
    [0, 0,  (M+m)*g/(M*L),           0],
  ]
  const Bc = [[0], [1/M], [0], [-1/(M*L)]]

  // First-order ZOH: A_d ≈ I + Ac·dt, B_d ≈ Bc·dt
  const Ad = Ac.map((row, i) =>
    row.map((v, j) => (i === j ? 1 : 0) + v * dt)
  )
  const Bd = Bc.map(row => row.map(v => v * dt))

  const Q  = [[q1,0,0,0],[0,q2,0,0],[0,0,q3,0],[0,0,0,q4]]
  const R  = [[r]]
  const P  = solveDARE(Ad, Bd, Q, R)
  const K  = computeK(Ad, Bd, P, R)   // 1×4
  return { K: K[0] }                   // flat [k1,k2,k3,k4]
}

// ─── Simulation ─────────────────────────────────────────────────────────────

function makePID(kp, ki, kd, intClamp = 15) {
  let integral = 0, prevErr = 0, init = false
  return {
    step(err, dt) {
      integral = clamp(integral + err * dt, -intClamp, intClamp)
      const d = init ? (err - prevErr) / dt : 0
      prevErr = err; init = true
      return kp * err + ki * integral + kd * d
    },
  }
}

function downsample(pts, maxN) {
  if (pts.length <= maxN) return pts
  const out = [], step = (pts.length - 1) / (maxN - 1)
  for (let i = 0; i < maxN; i++) out.push(pts[Math.round(i * step)])
  return out
}

export function runPendulumSimulation({
  mode,
  kp, ki, kd,
  q1, q2, q3, q4, r,
  initialTheta = 0.1,
  duration,
}) {
  const dt    = 0.01
  const steps = Math.round(clamp(duration, 2, 30) / dt)

  let K_pend = null
  let thetaPID = null

  if (mode === 'lqr') {
    const { K } = computePendulumLQRGains(q1, q2, q3, q4, r, dt)
    K_pend = K
  } else {
    thetaPID = makePID(kp, ki, kd, 20)
  }

  let x = 0, xd = 0, th = initialTheta, thd = 0
  let maxTheta   = Math.abs(initialTheta)
  let sumSqTheta = 0
  let fallen     = false
  let settlingStart = -1, settlingTime = duration
  const points = []

  for (let i = 0; i < steps; i++) {
    const t = i * dt

    let F = 0
    if (!fallen) {
      if (mode === 'lqr') {
        // Full state feedback: u = -K·[x, xd, th, thd]'
        F = -(K_pend[0]*x + K_pend[1]*xd + K_pend[2]*th + K_pend[3]*thd)
      } else {
        // PID on theta + light cart-centering
        // th > 0 (tilted right) → F > 0 (push cart right → restoring torque on pole) ✓
        F = thetaPID.step(th, dt) - 0.5*x - 0.3*xd
      }
      F = clamp(F, -F_MAX, F_MAX)
    }

    points.push({ t, x, x_dot: xd, theta: th, theta_dot: thd, force: F })

    if (Math.abs(th) > maxTheta) maxTheta = Math.abs(th)
    sumSqTheta += th * th

    // Settling: |θ| < 2°
    if (Math.abs(th) < 0.035) {
      if (settlingStart < 0) settlingStart = t
    } else {
      settlingStart = -1; settlingTime = duration
    }
    if (settlingStart >= 0 && settlingTime === duration) settlingTime = settlingStart

    if (Math.abs(th) > 0.9 * Math.PI) { fallen = true; continue }

    const next = rk4Step(x, xd, th, thd, F, dt)
    x   = clamp(next.x,  -X_LIMIT, X_LIMIT)
    xd  = Math.abs(next.x) >= X_LIMIT ? 0 : next.xd
    th  = next.th
    thd = next.thd
  }

  const finalTheta = points[points.length - 1]?.theta ?? 0

  return {
    points: downsample(points, 500),
    metrics: {
      settlingTime,
      overshoot:   Math.max(0, (maxTheta - Math.abs(initialTheta)) * 180 / Math.PI),
      rmsError:    Math.sqrt(sumSqTheta / steps) * 180 / Math.PI,
      steadyState: Math.abs(finalTheta) * 180 / Math.PI,
      fallen,
    },
    gains: K_pend ? { K: K_pend } : null,
  }
}
