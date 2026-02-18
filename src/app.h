#pragma once

#include <cstddef>
#include <memory>
#include <vector>

#include "control/pid.h"
#include "control/state_space.h"
#include "systems/system.h"
#include "ui/pid_panel.h"
#include "ui/state_space_panel.h"
#include "viz/zplane.h"

class Simulation {
public:
    Simulation();

    void reset();
    void clear_data();
    void update(double frame_dt);
    void set_pid_gains(double kp, double ki, double kd);
    void apply_input_impulse(double impulse);
    StateSpace current_state_space() const;

    void set_setpoint(double setpoint) { setpoint_ = setpoint; }
    double setpoint() const { return setpoint_; }
    double sim_time() const { return sim_time_; }
    double output() const { return y_; }
    double input() const { return u_; }

    const std::vector<double>& time_data() const { return time_data_; }
    const std::vector<double>& output_data() const { return output_data_; }
    const std::vector<double>& input_data() const { return input_data_; }

private:
    void step_once(double sim_dt);

    std::unique_ptr<System> plant_;
    std::vector<double> time_data_;
    std::vector<double> output_data_;
    std::vector<double> input_data_;
    double sim_time_ = 0.0;
    double accumulator_ = 0.0;
    double sim_dt_ = 0.001;
    double setpoint_ = 1.0;
    double y_ = 0.0;
    double u_ = 0.0;
    double disturbance_impulse_ = 0.0;
    std::size_t max_samples_ = 15000;
    PID pid_{};
};

class App {
public:
    void update(double frame_dt);
    void render();

private:
    Simulation simulation_{};
    bool auto_fit_plots_ = false;
    PIDPanelModel pid_panel_{};
    StateSpacePanelData state_space_panel_{};
    TransferFunctionVizState tf_viz_state_{};
};
