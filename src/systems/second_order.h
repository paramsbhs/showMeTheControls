#pragma once
#include "control/state_space.h"
#include "system.h"

class SecondOrderPlant : public System {
public:
    SecondOrderPlant(double m = 1.0, double k = 1.0, double b = 0.1, double Ts = 0.001);

    void reset() override;
    void step(double dt, double u) override;
    Eigen::VectorXd state() const override;
    double output() const override;
    StateSpace state_space() const;

    double mass{}, spring{}, damper{};
    double sample_time{};

private:
    void update_discrete_model(double dt);

    Eigen::Matrix2d A_{Eigen::Matrix2d::Identity()};
    Eigen::Vector2d B_{Eigen::Vector2d::Zero()};
    Eigen::RowVector2d C_{Eigen::RowVector2d::Zero()};
    double D_{0.0};
    Eigen::Vector2d x_{Eigen::Vector2d::Zero()};
    double last_u_{0.0};
    double cached_dt_{0.0};
};
