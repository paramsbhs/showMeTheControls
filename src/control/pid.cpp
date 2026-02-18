#include "pid.h"

#include <algorithm>
#include <cmath>

void PID::setGains(double kp, double ki, double kd) {
    kp_ = kp;
    ki_ = ki;
    kd_ = kd;
}

void PID::setIntegralLimit(double limit) {
    integral_limit_ = std::max(0.0, limit);
}

void PID::setOutputLimits(double min_output, double max_output) {
    if (min_output <= max_output) {
        output_min_ = min_output;
        output_max_ = max_output;
    }
}

double PID::compute(double setpoint, double measurement, double dt) {
    const double error = setpoint - measurement;

    if (dt > 0.0) {
        integral_ += error * dt;
        integral_ = std::clamp(integral_, -integral_limit_, integral_limit_);
    }

    const double derivative = dt > 0.0 ? (error - prev_error_) / dt : 0.0;
    prev_error_ = error;

    const double output = kp_ * error + ki_ * integral_ + kd_ * derivative;
    return std::clamp(output, output_min_, output_max_);
}

void PID::reset() {
    integral_ = 0.0;
    prev_error_ = 0.0;
}
