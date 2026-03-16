# showMeTheControls

A two-part interactive control systems learning environment:

| App | Description | Stack |
|-----|-------------|-------|
| **Desktop** (`src/`) | Simulink-style block-diagram sandbox — drag, wire, simulate | C++, ImGui, ImPlot, Eigen, GLFW |
| **Web** (`webapp/`) | Browser-based multi-vehicle simulator — PID & LQR tuning with 3D visualisation | React, Three.js, Zustand, Go |

---

## Desktop App

Interactive Simulink-style controller design sandbox.

### Features
- Block canvas with drag/drop node layout
- Block palette (Constant, Sum, Gain, Plant, Scope)
- Wire creation (output pin → input pin) and wire removal
- Safe scheduling with direct-feedthrough-aware cycle checks
- Time response plot from scope output
- Graph-based model extraction for canonical negative-feedback loop
- Real K-sweep closed-loop pole trajectory from extracted model

### Quick Start

```bash
git submodule update --init --recursive
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -j$(nproc)
./controllab
```

### Screenshots

![Control Theory Tutor UI](external/Screenshot%20from%202026-02-24%2010-54-33.png)
![Root Locus View](external/Screenshot%20from%202026-02-24%2010-55-27.png)

---

## Web App (ControlLab)

Browser-based simulator for tuning PID and LQR controllers on simulated vehicles with real-time 3D visualisation, plots, and performance metrics.

### Vehicles
- **Quadcopter** — 1-D vertical altitude control (PID / LQR)
- **F1TENTH car** — kinematic bicycle model on circular track (PID / LQR lateral)
- **Inverted pendulum** — full nonlinear cart-pole (PID / LQR)

### Stack
- **Frontend**: React + Vite, Three.js (`@react-three/fiber`), Recharts, Zustand
- **Backend**: Go (standard library, no external deps) — optional, all simulation runs in-browser by default

### Quick Start

#### Frontend only (recommended — all simulation runs in the browser)
```bash
cd webapp/frontend
npm install
npm run dev
# → http://localhost:5173
```

#### With Go backend
```bash
# Terminal 1
cd webapp/backend
go run .
# → http://localhost:8080

# Terminal 2
cd webapp/frontend
npm install
VITE_USE_LOCAL_SIM=false npm run dev
```

### How to use
1. Pick a **vehicle** (Quadcopter / F1TENTH / Pendulum) from the left panel
2. Choose **PID** or **LQR** mode and adjust the gains/weights
3. Or load a **Preset** from the Presets tab to start from a known tuning
4. Press **R** (or click Run) to simulate — results appear instantly
5. Press **Space** to play/pause the 3D playback; **←/→** to scrub
6. Check **Metrics** for settling time, overshoot, RMS error, and tuning score
7. Check **Plots** for time-series and (quadcopter) phase portrait
8. Toggle **📷 Follow / 🔭 Free** to switch between chase camera and free orbit
9. Click **Copy** on the Export box for ROS 2-ready YAML / Python gain snippet

### Project structure
```
webapp/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store/useSimStore.js          # Zustand state, URL sync, playback
│   │   ├── simulation/
│   │   │   ├── quadcopter.js             # RK4 quadcopter PID
│   │   │   ├── lqr.js                    # Quadcopter LQR
│   │   │   ├── f1tenth.js                # Bicycle model, circular track
│   │   │   ├── pendulum.js               # Cart-pole Euler-Lagrange
│   │   │   └── dare.js                   # Generic n×n DARE solver
│   │   └── components/
│   │       ├── SimCanvas.jsx             # Canvas router + HUD + follow-cam toggle
│   │       ├── ControlPanel.jsx          # Per-vehicle sliders & playback
│   │       ├── PlotPanel.jsx             # Recharts time-series & phase portrait
│   │       ├── MetricsPanel.jsx          # Score, tiles, export snippet
│   │       ├── PresetGallery.jsx         # 24 built-in presets
│   │       └── vehicles/
│   │           ├── QuadcopterScene.jsx
│   │           ├── F1TenthScene.jsx
│   │           └── PendulumScene.jsx
│   └── .env                              # VITE_USE_LOCAL_SIM=true
└── backend/
    ├── main.go                           # HTTP server, CORS
    ├── api/handlers.go                   # POST /api/simulate
    └── simulation/
        ├── pid.go
        └── quadcopter.go
```

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| `R` | Run simulation |
| `Space` | Play / Pause |
| `0` | Rewind to start |
| `←` / `→` | Scrub one frame |
