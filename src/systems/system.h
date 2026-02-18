#pragma once

#include <Eigen/Dense>

struct System {
    virtual ~System() = default;
    virtual void reset() = 0;
    virtual void step(double dt, double u) = 0;
    virtual Eigen::VectorXd state() const = 0;
    virtual double output() const = 0;
};
