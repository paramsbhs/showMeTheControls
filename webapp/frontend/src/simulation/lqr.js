/**
 * Discrete-time LQR for a 1-D quadcopter (z, vz).
 *
 * Continuous-time plant:
 *   dz/dt  = vz
 *   dvz/dt = u / m       (u = net thrust offset above hover)
 *
 * ZOH discretization at rate dt:
 *   A_d = [[1, dt], [0, 1]]
 *   B_d = [[dt²/2m], [dt/m]]
 *
 * Cost:   J = Σ (x'Qx + u'Ru)
 *   Q = diag(q1, q2)  — penalise position error, velocity
 *   R = [r]           — penalise control effort
 *
 * Solves DARE via value iteration (converges quickly for this 2×2 case).
 * Returns { K, P } where control law is: u = -K * (x - x_ref)
 */

const MASS = 0.5
const GRAVITY = 9.81
const HOVER_THRUST = MASS * GRAVITY
const MAX_NET = 15.0

// ─── tiny 2×2 matrix helpers ───────────────────────────────────────────────

function mat2x2(a, b, c, d) { return [[a, b], [c, d]] }

function add2(A, B) {
  return [[A[0][0]+B[0][0], A[0][1]+B[0][1]],
          [A[1][0]+B[1][0], A[1][1]+B[1][1]]]
}

function sub2(A, B) {
  return [[A[0][0]-B[0][0], A[0][1]-B[0][1]],
          [A[1][0]-B[1][0], A[1][1]-B[1][1]]]
}

function mul2(A, B) {
  return [
    [A[0][0]*B[0][0]+A[0][1]*B[1][0], A[0][0]*B[0][1]+A[0][1]*B[1][1]],
    [A[1][0]*B[0][0]+A[1][1]*B[1][0], A[1][0]*B[0][1]+A[1][1]*B[1][1]],
  ]
}

function transpose2(A) {
  return [[A[0][0], A[1][0]], [A[0][1], A[1][1]]]
}

// 2×1 column vector helpers
function matvec2(A, v) {
  return [A[0][0]*v[0]+A[0][1]*v[1], A[1][0]*v[0]+A[1][1]*v[1]]
}

// scalar multiply matrix
function scale2(A, s) {
  return [[A[0][0]*s, A[0][1]*s], [A[1][0]*s, A[1][1]*s]]
}

// invert 2×2
function inv2(A) {
  const det = A[0][0]*A[1][1] - A[0][1]*A[1][0]
  if (Math.abs(det) < 1e-12) return mat2x2(1,0,0,1) // fallback
  return scale2(mat2x2(A[1][1], -A[0][1], -A[1][0], A[0][0]), 1/det)
}

// ─── DARE solver ────────────────────────────────────────────────────────────

/**
 * Solve the discrete-time algebraic Riccati equation via value iteration.
 * P_{k+1} = Q + A'PA - A'PB(B'PB+R)^{-1}B'PA
 */
function solveDARE(Ad, Bd, Q, R, maxIter = 200, tol = 1e-9) {
  let P = [[Q[0][0], 0], [0, Q[1][1]]] // start from Q

  const At = transpose2(Ad)
  const Bt = transpose2(Bd) // 1×2

  for (let i = 0; i < maxIter; i++) {
    // S = B'PB + R  (scalar for 1-input system)
    const BtP = [
      Bt[0][0]*P[0][0]+Bt[0][1]*P[1][0],
      Bt[0][0]*P[0][1]+Bt[0][1]*P[1][1],
    ]
    const S = BtP[0]*Bd[0][0] + BtP[1]*Bd[1][0] + R

    // K_gain = (B'PB+R)^{-1} B'PA  (1×2)
    const AtP = mul2(At, P)
    const BtPA = [
      Bt[0][0]*AtP[0][0]+Bt[0][1]*AtP[1][0],
      Bt[0][0]*AtP[0][1]+Bt[0][1]*AtP[1][1],
    ] // 1×2
    const Kgain = [BtPA[0]/S, BtPA[1]/S]

    // A'PB * Kgain  (2×2 outer product scaled)
    const AtPB = [At[0][0]*P[0][0]*Bd[0][0]+At[0][0]*P[0][1]*Bd[1][0]+At[0][1]*P[1][0]*Bd[0][0]+At[0][1]*P[1][1]*Bd[1][0],
                  At[1][0]*P[0][0]*Bd[0][0]+At[1][0]*P[0][1]*Bd[1][0]+At[1][1]*P[1][0]*Bd[0][0]+At[1][1]*P[1][1]*Bd[1][0]]
    // correction term: AtPB * Kgain' (2×2)
    const correction = [
      [AtPB[0]*Kgain[0], AtPB[0]*Kgain[1]],
      [AtPB[1]*Kgain[0], AtPB[1]*Kgain[1]],
    ]

    const Pnew = sub2(add2(Q, mul2(At, mul2(P, Ad))), correction)

    // Check convergence
    const diff = Math.abs(Pnew[0][0]-P[0][0]) + Math.abs(Pnew[0][1]-P[0][1])
              + Math.abs(Pnew[1][0]-P[1][0]) + Math.abs(Pnew[1][1]-P[1][1])
    P = Pnew
    if (diff < tol) break
  }

  return P
}

export function computeLQRGains(q1, q2, r, dt = 0.01) {
  const Ad = [[1, dt], [0, 1]]
  const Bd = [[dt*dt/(2*MASS)], [dt/MASS]]
  const Q = [[q1, 0], [0, q2]]

  const P = solveDARE(Ad, Bd, Q, r)

  // K = (B'PB + R)^{-1} B'PA  (1×2 row vector)
  const At = transpose2(Ad)
  const Bt = [[Bd[0][0], Bd[1][0]]] // 1×2

  const BtP = [
    Bt[0][0]*P[0][0]+Bt[0][1]*P[1][0],
    Bt[0][0]*P[0][1]+Bt[0][1]*P[1][1],
  ]
  const S = BtP[0]*Bd[0][0] + BtP[1]*Bd[1][0] + r

  const AtP = mul2(At, P)
  const BtPA = [
    Bt[0][0]*AtP[0][0]+Bt[0][1]*AtP[1][0],
    Bt[0][0]*AtP[0][1]+Bt[0][1]*AtP[1][1],
  ]
  const K = [BtPA[0]/S, BtPA[1]/S]

  return { K, P }
}

// ─── Simulation ─────────────────────────────────────────────────────────────

function rk4Step(z, vz, u, dt) {
  const f = (vz, u) => ({ dz: vz, dvz: Math.max(-HOVER_THRUST, Math.min(MAX_NET, u)) / MASS })
  const k1 = f(vz, u)
  const k2 = f(vz + k1.dvz*dt/2, u)
  const k3 = f(vz + k2.dvz*dt/2, u)
  const k4 = f(vz + k3.dvz*dt, u)
  return {
    z:  z  + dt/6*(k1.dz +2*k2.dz +2*k3.dz +k4.dz),
    vz: vz + dt/6*(k1.dvz+2*k2.dvz+2*k3.dvz+k4.dvz),
  }
}

function downsample(pts, maxN) {
  if (pts.length <= maxN) return pts
  const out = []
  const step = (pts.length - 1) / (maxN - 1)
  for (let i = 0; i < maxN; i++) out.push(pts[Math.round(i * step)])
  return out
}

export function runLQRSimulation({ q1, q2, r, setpoint, initialZ, duration }) {
  const dt = 0.01
  const steps = Math.round(Math.min(Math.max(duration, 2), 30) / dt)

  const { K } = computeLQRGains(q1, q2, r, dt)

  let z = initialZ ?? 0
  let vz = 0

  const band = Math.max(0.02, 0.02 * Math.abs(setpoint - z))
  let maxZ = z
  let settlingStart = -1
  let settlingTime = duration
  let sumSqErr = 0
  const points = []

  for (let i = 0; i < steps; i++) {
    const t = i * dt
    const ez = setpoint - z
    const evz = 0 - vz       // target velocity = 0
    const u = K[0]*ez + K[1]*evz   // LQR: u = -K*(x - x_ref)  → K acts on error directly

    points.push({ t, z, vz, error: ez, thrust: HOVER_THRUST + u })

    if (z > maxZ) maxZ = z
    sumSqErr += ez * ez

    if (Math.abs(ez) <= band) {
      if (settlingStart < 0) settlingStart = t
    } else {
      settlingStart = -1
      settlingTime = duration
    }
    if (settlingStart >= 0 && settlingTime === duration) settlingTime = settlingStart

    const next = rk4Step(z, vz, u, dt)
    z = next.z; vz = next.vz
  }

  const finalError = points[points.length - 1]?.error ?? 0
  const ref = setpoint - initialZ
  const overshoot = (ref > 0 && maxZ > setpoint) ? ((maxZ - setpoint) / ref) * 100 : 0

  return {
    points: downsample(points, 500),
    metrics: {
      settlingTime,
      overshoot,
      rmsError: Math.sqrt(sumSqErr / steps),
      steadyState: Math.abs(finalError),
    },
    gains: { K },
  }
}
