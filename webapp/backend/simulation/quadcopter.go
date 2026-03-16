package simulation

import "math"

const (
	mass    = 0.5   // kg
	gravity = 9.81  // m/s²
	// hover thrust exactly cancels gravity
	hoverThrust = mass * gravity
	// max net thrust above hover (limits authority)
	maxNetThrust = 15.0 // N
)

// QuadState is the 1-D vertical state [z, vz].
type QuadState struct {
	Z  float64 // height (m)
	Vz float64 // vertical velocity (m/s)
}

// derivatives returns [dz/dt, dvz/dt] given state and net thrust input u.
func derivatives(s QuadState, u float64) QuadState {
	// clamp net thrust to physical limits
	if u > maxNetThrust {
		u = maxNetThrust
	} else if u < -hoverThrust {
		u = -hoverThrust
	}
	// z_ddot = (hoverThrust + u - m*g) / m  =  u / m
	zddot := u / mass
	return QuadState{Z: s.Vz, Vz: zddot}
}

// rk4Step advances the state by dt using classic RK4.
func rk4Step(s QuadState, u, dt float64) QuadState {
	add := func(a, b QuadState, scale float64) QuadState {
		return QuadState{Z: a.Z + scale*b.Z, Vz: a.Vz + scale*b.Vz}
	}
	k1 := derivatives(s, u)
	k2 := derivatives(add(s, k1, dt/2), u)
	k3 := derivatives(add(s, k2, dt/2), u)
	k4 := derivatives(add(s, k3, dt), u)

	return QuadState{
		Z:  s.Z + dt/6*(k1.Z+2*k2.Z+2*k3.Z+k4.Z),
		Vz: s.Vz + dt/6*(k1.Vz+2*k2.Vz+2*k3.Vz+k4.Vz),
	}
}

// SimParams contains simulation configuration.
type SimParams struct {
	Kp       float64 `json:"kp"`
	Ki       float64 `json:"ki"`
	Kd       float64 `json:"kd"`
	Setpoint float64 `json:"setpoint"` // target altitude (m)
	Duration float64 `json:"duration"` // simulation time (s)
	InitialZ float64 `json:"initialZ"` // starting altitude (m)
}

// SimPoint is one time-series sample.
type SimPoint struct {
	T        float64 `json:"t"`
	Z        float64 `json:"z"`
	Vz       float64 `json:"vz"`
	Error    float64 `json:"error"`
	Thrust   float64 `json:"thrust"`
}

// Metrics are scalar performance indicators.
type Metrics struct {
	SettlingTime float64 `json:"settlingTime"` // s (±2% band)
	Overshoot    float64 `json:"overshoot"`    // %
	RMSError     float64 `json:"rmsError"`
	SteadyState  float64 `json:"steadyState"`  // final error
}

// SimResult is what the API returns.
type SimResult struct {
	Points  []SimPoint `json:"points"`
	Metrics Metrics    `json:"metrics"`
}

// Run executes the simulation and returns the full result.
func Run(p SimParams) SimResult {
	if p.Duration <= 0 || p.Duration > 30 {
		p.Duration = 10
	}
	dt := 0.01  // 100 Hz
	steps := int(p.Duration / dt)

	state := QuadState{Z: p.InitialZ, Vz: 0}
	ctrl := &PID{Kp: p.Kp, Ki: p.Ki, Kd: p.Kd}

	points := make([]SimPoint, 0, steps)

	// Metrics tracking
	var sumSqErr float64
	maxZ := p.InitialZ
	settlingTime := -1.0
	band := 0.02 * math.Abs(p.Setpoint-p.InitialZ)
	if band < 0.02 {
		band = 0.02
	}

	for i := 0; i < steps; i++ {
		t := float64(i) * dt
		err := p.Setpoint - state.Z
		u := ctrl.Step(err, dt) // net thrust offset

		pt := SimPoint{
			T:      t,
			Z:      state.Z,
			Vz:     state.Vz,
			Error:  err,
			Thrust: hoverThrust + u,
		}
		points = append(points, pt)

		// track max height for overshoot
		if state.Z > maxZ {
			maxZ = state.Z
		}

		// settling: within ±band of setpoint and stays there
		if math.Abs(err) <= band && settlingTime < 0 {
			settlingTime = t
		} else if math.Abs(err) > band {
			settlingTime = -1
		}

		sumSqErr += err * err
		state = rk4Step(state, u, dt)
	}

	// downsample to 500 points max for transport
	points = downsample(points, 500)

	overshoot := 0.0
	if p.Setpoint > p.InitialZ {
		ref := p.Setpoint - p.InitialZ
		if ref > 0 && maxZ > p.Setpoint {
			overshoot = (maxZ - p.Setpoint) / ref * 100
		}
	}

	if settlingTime < 0 {
		settlingTime = p.Duration // never settled
	}

	finalErr := 0.0
	if len(points) > 0 {
		finalErr = points[len(points)-1].Error
	}

	return SimResult{
		Points: points,
		Metrics: Metrics{
			SettlingTime: settlingTime,
			Overshoot:    overshoot,
			RMSError:     math.Sqrt(sumSqErr / float64(steps)),
			SteadyState:  math.Abs(finalErr),
		},
	}
}

func downsample(pts []SimPoint, maxN int) []SimPoint {
	if len(pts) <= maxN {
		return pts
	}
	out := make([]SimPoint, maxN)
	step := float64(len(pts)-1) / float64(maxN-1)
	for i := 0; i < maxN; i++ {
		out[i] = pts[int(math.Round(float64(i)*step))]
	}
	return out
}
