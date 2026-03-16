package simulation

// PID holds controller state between steps.
type PID struct {
	Kp, Ki, Kd float64
	integral    float64
	prevError   float64
	initialized bool
}

// Step computes the PID output for a given error and time step dt.
// Integral clamped to ±50 to prevent windup.
func (p *PID) Step(err, dt float64) float64 {
	p.integral += err * dt
	if p.integral > 50 {
		p.integral = 50
	} else if p.integral < -50 {
		p.integral = -50
	}

	var derivative float64
	if p.initialized {
		derivative = (err - p.prevError) / dt
	}
	p.prevError = err
	p.initialized = true

	return p.Kp*err + p.Ki*p.integral + p.Kd*derivative
}

func (p *PID) Reset() {
	p.integral = 0
	p.prevError = 0
	p.initialized = false
}
