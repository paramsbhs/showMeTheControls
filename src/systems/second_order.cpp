#include "second_order.h"

SecondOrderPlant::SecondOrderPlant(double m, double k, double b, double Ts)
    : mass(m), spring(k), damper(b), sample_time(Ts) {
    C_ << 1.0, 0.0;
    D_ = 0.0;
    update_discrete_model(sample_time);
    reset();
}

void SecondOrderPlant::reset() {
    x_.setZero();
    last_u_ = 0.0;
}

void SecondOrderPlant::step(double dt, double u) {
    const double h = dt > 0.0 ? dt : sample_time;
    if (h != cached_dt_) {
        update_discrete_model(h);
    }
    last_u_ = u;
    x_ = A_ * x_ + B_ * u;
}

Eigen::VectorXd SecondOrderPlant::state() const {
    return x_;
}

double SecondOrderPlant::output() const {
    return (C_ * x_)(0) + D_ * last_u_;
}

void SecondOrderPlant::update_discrete_model(double dt) {
    cached_dt_ = dt;

    const double inv_m = 1.0 / mass;
    A_ << 1.0, dt,
          -(spring * inv_m) * dt, 1.0 - (damper * inv_m) * dt;
    B_ << 0.0,
          dt * inv_m;
}

StateSpace SecondOrderPlant::state_space() const {
    StateSpace ss;
    ss.A = A_;
    ss.B = B_;
    ss.C = C_;
    ss.D = Eigen::Matrix<double, 1, 1>::Constant(D_);
    return ss;
}
