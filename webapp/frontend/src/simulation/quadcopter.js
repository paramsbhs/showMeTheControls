/**
 * In-browser quadcopter simulation — mirrors the Go backend exactly.
 * Used when the Go server is unavailable (or as the default local engine).
 */

const MASS = 0.5        // kg
const GRAVITY = 9.81    // m/s²
const HOVER_THRUST = MASS * GRAVITY
const MAX_NET_THRUST = 15.0  // N

// PID controller with anti-windup
function makePID(kp, ki, kd) {
  let integral = 0
  let prevError = 0
  let initialized = false

  return {
    step(error, dt) {
      integral += error * dt
      if (integral > 50) integral = 50
      else if (integral < -50) integral = -50

      let derivative = 0
      if (initialized) {
        derivative = (error - prevError) / dt
      }
      prevError = error
      initialized = true

      return kp * error + ki * integral + kd * derivative
    },
    reset() {
      integral = 0; prevError = 0; initialized = false
    },
  }
}

// RK4 integrator for state [z, vz]
function derivatives(z, vz, u) {
  let netThrust = Math.max(-HOVER_THRUST, Math.min(MAX_NET_THRUST, u))
  const zddot = netThrust / MASS
  return { dz: vz, dvz: zddot }
}

function rk4Step(z, vz, u, dt) {
  const k1 = derivatives(z, vz, u)
  const k2 = derivatives(z + k1.dz * dt / 2, vz + k1.dvz * dt / 2, u)
  const k3 = derivatives(z + k2.dz * dt / 2, vz + k2.dvz * dt / 2, u)
  const k4 = derivatives(z + k3.dz * dt, vz + k3.dvz * dt, u)

  return {
    z:  z  + dt / 6 * (k1.dz  + 2*k2.dz  + 2*k3.dz  + k4.dz),
    vz: vz + dt / 6 * (k1.dvz + 2*k2.dvz + 2*k3.dvz + k4.dvz),
  }
}

function downsample(pts, maxN) {
  if (pts.length <= maxN) return pts
  const out = []
  const step = (pts.length - 1) / (maxN - 1)
  for (let i = 0; i < maxN; i++) {
    out.push(pts[Math.round(i * step)])
  }
  return out
}

export function runSimulation({ kp, ki, kd, setpoint, initialZ, duration }) {
  const dt = 0.01
  const steps = Math.round(Math.min(Math.max(duration, 2), 30) / dt)
  const pid = makePID(kp, ki, kd)

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
    const error = setpoint - z
    const u = pid.step(error, dt)

    points.push({ t, z, vz, error, thrust: HOVER_THRUST + u })

    if (z > maxZ) maxZ = z
    sumSqErr += error * error

    // settling: must stay within band
    if (Math.abs(error) <= band) {
      if (settlingStart < 0) settlingStart = t
    } else {
      settlingStart = -1
      settlingTime = duration
    }
    if (settlingStart >= 0 && settlingTime === duration) {
      settlingTime = settlingStart
    }

    const next = rk4Step(z, vz, u, dt)
    z = next.z
    vz = next.vz
  }

  const finalError = points[points.length - 1]?.error ?? 0
  const ref = setpoint - initialZ

  let overshoot = 0
  if (ref > 0 && maxZ > setpoint) {
    overshoot = ((maxZ - setpoint) / ref) * 100
  }

  return {
    points: downsample(points, 500),
    metrics: {
      settlingTime,
      overshoot,
      rmsError: Math.sqrt(sumSqErr / steps),
      steadyState: Math.abs(finalError),
    },
  }
}
