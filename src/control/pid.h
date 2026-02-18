#pragma once

class PID {
public:
    void setGains(double kp, double ki, double kd);
    void setIntegralLimit(double limit);
    void setOutputLimits(double min_output, double max_output);

    double compute(double setpoint, double measurement, double dt);
    void reset();

private:
    double kp_ = 0.0;
    double ki_ = 0.0;
    double kd_ = 0.0;
    double integral_ = 0.0;
    double prev_error_ = 0.0;
    double integral_limit_ = 10.0;
    double output_min_ = -20.0;
    double output_max_ = 20.0;
};
