# ControlLab — Quadcopter PID Web Simulator (MVP)

Interactive web app to tune PID controllers on a simulated quadcopter with real-time 3D visualization, plots, and performance metrics.

## Stack
- **Frontend**: React + Vite + Three.js (@react-three/fiber) + Recharts + Zustand
- **Backend**: Go (standard library only, no external deps)
- **Sharing** (Week 3): Supabase

## Quick Start

### 1. Install Go
Go is required for the backend.

**Windows (Chocolatey):**
```
choco install golang -y
```
Then restart your terminal so `go` is in PATH.

Or download from https://go.dev/dl/

### 2. Start the backend
```bash
cd backend
go run .
# → listening on http://localhost:8080
```

### 3. Start the frontend
```bash
cd frontend
npm install   # first time only
npm run dev
# → http://localhost:5173
```

## How to use
1. **Adjust sliders** (Kp, Ki, Kd) on the left panel
2. **Set target altitude** and duration
3. Click **▶ Run Simulation** — the Go backend computes RK4-integrated quadcopter dynamics
4. Watch the **3D drone** animate to the setpoint in the center
5. Switch to **Plots** tab for altitude/error/velocity/thrust time-series
6. Check **Metrics** for settling time, overshoot %, RMS error, and a tuning score
7. Click **▶ / ⏸** in Playback section to replay the trajectory
8. Hit **Copy** on the Export box to get ROS 2-ready YAML

## Physics model
- 1-D vertical dynamics (z-axis), RK4 at 100 Hz
- Mass: 0.5 kg, gravity: 9.81 m/s²
- Hover thrust = mass × g; PID controls net thrust offset
- Integral windup clamp: ±50

## Project structure
```
webapp/
├── backend/
│   ├── main.go                  # HTTP server, CORS
│   ├── go.mod
│   ├── api/handlers.go          # /api/simulate, /api/health
│   └── simulation/
│       ├── pid.go               # PID controller
│       └── quadcopter.go        # RK4, physics, metrics
└── frontend/
    ├── src/
    │   ├── App.jsx              # Layout (sidebar/canvas/right panel)
    │   ├── store/useSimStore.js # Zustand state + fetch logic
    │   └── components/
    │       ├── DroneCanvas.jsx  # Three.js 3D scene
    │       ├── ControlPanel.jsx # Sliders, presets, playback
    │       ├── PlotPanel.jsx    # Recharts time-series plots
    │       └── MetricsPanel.jsx # Metrics + export snippet
    └── .env                     # VITE_API_URL=http://localhost:8080
```

## Roadmap
- Week 2 ✅: Core UI (this MVP)
- Week 3: Supabase preset save/load/upvote gallery
- Week 4: LQR tuning (Q/R matrix inputs)
- Week 5: F1TENTH car model
- Week 6: Embed widget + community leaderboard
