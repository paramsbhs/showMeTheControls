#include "app.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <memory>

#include <imgui.h>
#include <implot.h>

#include "systems/second_order.h"
#include "ui/pid_panel.h"
#include "ui/state_space_panel.h"
#include "viz/zplane.h"

Simulation::Simulation() : plant_(std::make_unique<SecondOrderPlant>()) {
    pid_.setGains(2.0, 0.5, 0.05);
    pid_.setIntegralLimit(5.0);
    pid_.setOutputLimits(-20.0, 20.0);
    reset();
}

void Simulation::reset() {
    plant_->reset();
    pid_.reset();
    clear_data();
}

void Simulation::clear_data() {
    time_data_.clear();
    output_data_.clear();
    input_data_.clear();
    sim_time_ = 0.0;
    accumulator_ = 0.0;
    y_ = 0.0;
    u_ = 0.0;
    disturbance_impulse_ = 0.0;
}

void Simulation::set_pid_gains(double kp, double ki, double kd) {
    pid_.setGains(kp, ki, kd);
}

void Simulation::apply_input_impulse(double impulse) {
    disturbance_impulse_ += impulse;
}

StateSpace Simulation::current_state_space() const {
    if (const auto* plant = dynamic_cast<const SecondOrderPlant*>(plant_.get())) {
        return plant->state_space();
    }
    return CreateSecondOrderExampleStateSpace();
}

void Simulation::update(double frame_dt) {
    accumulator_ += frame_dt;
    while (accumulator_ >= sim_dt_) {
        step_once(sim_dt_);
        accumulator_ -= sim_dt_;
    }
}

void Simulation::step_once(double sim_dt) {
    const double y_measured = plant_->output();
    u_ = pid_.compute(setpoint_, y_measured, sim_dt);
    if (disturbance_impulse_ != 0.0) {
        u_ += disturbance_impulse_;
        disturbance_impulse_ = 0.0;
    }
    plant_->step(sim_dt, u_);

    sim_time_ += sim_dt;
    y_ = plant_->output();

    time_data_.push_back(sim_time_);
    output_data_.push_back(y_);
    input_data_.push_back(u_);

    if (time_data_.size() > max_samples_) {
        const std::size_t keep = max_samples_ / 2;
        const std::size_t start = time_data_.size() - keep;
        time_data_.erase(time_data_.begin(), time_data_.begin() + static_cast<std::ptrdiff_t>(start));
        output_data_.erase(output_data_.begin(), output_data_.begin() + static_cast<std::ptrdiff_t>(start));
        input_data_.erase(input_data_.begin(), input_data_.begin() + static_cast<std::ptrdiff_t>(start));
    }
}

void App::update(double frame_dt) {
    simulation_.update(frame_dt);
}

void App::render() {
    ImGui::Begin("Control Lab");
    ImGui::Text("Phase 1: SISO time-domain simulation");
    ImGui::Separator();

    double setpoint = simulation_.setpoint();
    const double min_setpoint = -5.0;
    const double max_setpoint = 5.0;
    if (ImGui::SliderScalar("Step Input", ImGuiDataType_Double, &setpoint, &min_setpoint, &max_setpoint, "%.2f")) {
        simulation_.set_setpoint(setpoint);
    }

    if (ImGui::Button("Reset Plant")) {
        simulation_.reset();
    }
    ImGui::SameLine();
    if (ImGui::Button("Clear Plots")) {
        simulation_.clear_data();
    }
    ImGui::SameLine();
    ImGui::Checkbox("Auto-fit Plots", &auto_fit_plots_);

    DrawPIDPanel(pid_panel_);
    if (pid_panel_.gains_changed) {
        simulation_.set_pid_gains(pid_panel_.kp, pid_panel_.ki, pid_panel_.kd);
        pid_panel_.gains_changed = false;
    }
    if (pid_panel_.reset_requested) {
        simulation_.reset();
        pid_panel_.reset_requested = false;
    }
    if (pid_panel_.disturbance_requested) {
        simulation_.apply_input_impulse(static_cast<double>(pid_panel_.disturbance));
        pid_panel_.disturbance_requested = false;
    }

    DrawTransferFunctionPanel(tf_viz_state_);
    state_space_panel_.system = simulation_.current_state_space();
    DrawStateSpacePanel(state_space_panel_);

    ImGui::Text("t = %.3f s", simulation_.sim_time());
    ImGui::Text("y = %.4f, u = %.4f", simulation_.output(), simulation_.input());

    const auto& t = simulation_.time_data();
    const auto& y = simulation_.output_data();
    const auto& u = simulation_.input_data();
    const int count = static_cast<int>(std::min({t.size(), y.size(), u.size()}));
    const double t_now = simulation_.sim_time();
    const double t_min = std::max(0.0, t_now - 10.0);
    const double t_max = std::max(10.0, t_now);

    double y_min = -0.1;
    double y_max = 1.1;
    if (count > 0) {
        auto [y_it_min, y_it_max] = std::minmax_element(y.begin(), y.end());
        y_min = *y_it_min;
        y_max = *y_it_max;
        const double span = std::max(0.2, y_max - y_min);
        const double pad = 0.1 * span;
        y_min -= pad;
        y_max += pad;
    }
    y_min = std::min(y_min, -0.1);
    y_max = std::max({y_max, simulation_.setpoint() + 0.1, 0.1});

    const double u_center = simulation_.setpoint();
    double u_min = u_center - std::max(0.2, std::abs(u_center) * 0.5);
    double u_max = u_center + std::max(0.2, std::abs(u_center) * 0.5);
    if (count > 0) {
        auto [u_it_min, u_it_max] = std::minmax_element(u.begin(), u.end());
        const double data_min = *u_it_min;
        const double data_max = *u_it_max;
        const double span = std::max(0.2, data_max - data_min);
        const double pad = 0.1 * span;
        u_min = std::min(u_min, data_min - pad);
        u_max = std::max(u_max, data_max + pad);
    }

    if (ImPlot::BeginPlot("Plant Output y(t)", ImVec2(-1.0f, 220.0f))) {
        ImPlot::SetupAxes("Time (s)", "y");
        if (!auto_fit_plots_) {
            ImPlot::SetupAxisLimits(ImAxis_X1, t_min, t_max, ImGuiCond_Always);
            ImPlot::SetupAxisLimits(ImAxis_Y1, y_min, y_max, ImGuiCond_Always);
        }
        if (count > 0) {
            ImPlot::PlotLine("y", t.data(), y.data(), count);
        }
        ImPlot::EndPlot();
    }

    if (ImPlot::BeginPlot("Input u(t)", ImVec2(-1.0f, 180.0f))) {
        ImPlot::SetupAxes("Time (s)", "u");
        if (!auto_fit_plots_) {
            ImPlot::SetupAxisLimits(ImAxis_X1, t_min, t_max, ImGuiCond_Always);
            ImPlot::SetupAxisLimits(ImAxis_Y1, u_min, u_max, ImGuiCond_Always);
        }
        if (count > 0) {
            ImPlot::PlotLine("u", t.data(), u.data(), count);
        }
        ImPlot::EndPlot();
    }

    ImGui::End();
}
