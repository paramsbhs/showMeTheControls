import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { runSimulation as runPID }    from '../simulation/quadcopter'
import { runLQRSimulation }           from '../simulation/lqr'
import { runF1TenthSimulation }       from '../simulation/f1tenth'
import { runPendulumSimulation }      from '../simulation/pendulum'

// ─── URL sync ────────────────────────────────────────────────────────────────

const URL_KEYS = [
  'vehicle','mode',
  // quad
  'kp','ki','kd','q1','q2','r','setpoint','initialZ','duration',
  // f1tenth
  'f1TargetSpeed','f1KpV','f1KiV','f1KdV','f1KpL','f1KiL','f1KdL',
  'f1Q1L','f1Q2L','f1RL','f1Duration',
  // pendulum
  'pendKp','pendKi','pendKd',
  'pendQ1','pendQ2','pendQ3','pendQ4','pendR',
  'pendTheta0','pendDuration',
]

const STR_KEYS = new Set(['vehicle', 'mode'])

function readURL() {
  const p = new URLSearchParams(window.location.hash.slice(1))
  const out = {}
  for (const k of URL_KEYS) {
    const v = p.get(k)
    if (v !== null) out[k] = STR_KEYS.has(k) ? v : parseFloat(v)
  }
  return out
}

function writeURL(s) {
  const p = new URLSearchParams()
  for (const k of URL_KEYS) {
    if (s[k] !== undefined) p.set(k, s[k])
  }
  history.replaceState(null, '', '#' + p.toString())
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  vehicle: 'quadcopter',  // 'quadcopter' | 'f1tenth' | 'pendulum'
  mode: 'pid',            // 'pid' | 'lqr'

  // ── Quadcopter ──
  kp: 4.0, ki: 0.5, kd: 2.0,
  q1: 10.0, q2: 1.0, r: 0.1,
  setpoint: 5.0, initialZ: 0.0, duration: 10.0,

  // ── F1TENTH ──
  f1TargetSpeed: 3.0,
  f1KpV: 2.0, f1KiV: 0.5,  f1KdV: 0.05,   // speed PID
  f1KpL: 0.9, f1KiL: 0.0,  f1KdL: 0.15,   // lateral PID
  f1Q1L: 50,  f1Q2L: 5.0,  f1RL:  0.1,    // lateral LQR
  f1Duration: 20.0,

  // ── Pendulum ──
  pendKp: 35.0, pendKi: 0.0, pendKd: 6.0,
  pendQ1: 5.0, pendQ2: 1.0, pendQ3: 120.0, pendQ4: 12.0, pendR: 0.05,
  pendTheta0: 0.1,
  pendDuration: 10.0,
}

const PERSIST_KEYS = URL_KEYS   // persist same set as URL

// ─── Store ───────────────────────────────────────────────────────────────────

export const useSimStore = create(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      ...readURL(),

      points: [], metrics: null, gains: null,
      loading: false, error: null,
      playhead: 0, playing: false, playInterval: null,
      followCam: true,
      toggleFollowCam: () => set(s => ({ followCam: !s.followCam })),

      setParam: (key, val) => { set({ [key]: val }); writeURL(get()) },

      setVehicle: (vehicle) => {
        set({ vehicle, points: [], metrics: null, gains: null, playhead: 0 })
        writeURL({ ...get(), vehicle })
      },

      setMode: (mode) => {
        set({ mode, points: [], metrics: null, gains: null, playhead: 0 })
        writeURL({ ...get(), mode })
      },

      applyPreset: (preset) => {
        const patch = { ...preset }
        delete patch.id; delete patch.name; delete patch.desc
        set(patch)
        writeURL({ ...get(), ...patch })
      },

      runSimulation: async () => {
        const s = get()
        if (s.playInterval) clearInterval(s.playInterval)
        set({ loading: true, error: null, playing: false, playhead: 0, playInterval: null })

        try {
          let data
          if (s.vehicle === 'f1tenth') {
            data = runF1TenthSimulation({
              mode:        s.mode,
              targetSpeed: s.f1TargetSpeed,
              kpV: s.f1KpV, kiV: s.f1KiV, kdV: s.f1KdV,
              kpL: s.f1KpL, kiL: s.f1KiL, kdL: s.f1KdL,
              q1L: s.f1Q1L, q2L: s.f1Q2L, rL:  s.f1RL,
              duration: s.f1Duration,
            })
          } else if (s.vehicle === 'pendulum') {
            data = runPendulumSimulation({
              mode:         s.mode,
              kp: s.pendKp, ki: s.pendKi, kd: s.pendKd,
              q1: s.pendQ1, q2: s.pendQ2, q3: s.pendQ3,
              q4: s.pendQ4, r:  s.pendR,
              initialTheta: s.pendTheta0,
              duration:     s.pendDuration,
            })
          } else if (s.mode === 'lqr') {
            data = runLQRSimulation({
              q1: s.q1, q2: s.q2, r: s.r,
              setpoint: s.setpoint, initialZ: s.initialZ, duration: s.duration,
            })
            data.gains = data.gains   // already included
          } else {
            data = runPID({
              kp: s.kp, ki: s.ki, kd: s.kd,
              setpoint: s.setpoint, initialZ: s.initialZ, duration: s.duration,
            })
          }
          set({ points: data.points, metrics: data.metrics, gains: data.gains ?? null, loading: false })
        } catch (e) {
          set({ error: e.message, loading: false })
        }
      },

      play: () => {
        const { points, playing } = get()
        if (!points.length || playing) return
        const iv = setInterval(() => {
          const { playhead, points } = get()
          if (playhead >= points.length - 1) {
            clearInterval(get().playInterval); set({ playing: false, playInterval: null })
          } else {
            set({ playhead: playhead + 1 })
          }
        }, 20)
        set({ playing: true, playInterval: iv })
      },

      pause: () => { const iv = get().playInterval; if (iv) clearInterval(iv); set({ playing: false, playInterval: null }) },
      reset: () => { const iv = get().playInterval; if (iv) clearInterval(iv); set({ playing: false, playInterval: null, playhead: 0 }) },
      scrub: (idx) => { const iv = get().playInterval; if (iv) clearInterval(iv); set({ playing: false, playInterval: null, playhead: idx }) },

      getShareURL: () => { writeURL(get()); return window.location.href },
    }),
    {
      name: 'controllab-v2',
      partialize: (s) => Object.fromEntries(PERSIST_KEYS.map(k => [k, s[k]])),
    }
  )
)
