#include "state_space.h"

#include <algorithm>

namespace {

Eigen::MatrixXd MatrixPower(const Eigen::MatrixXd& A, int power) {
    Eigen::MatrixXd result = Eigen::MatrixXd::Identity(A.rows(), A.cols());
    for (int i = 0; i < power; ++i) {
        result *= A;
    }
    return result;
}

} // namespace

StateSpace CreateSecondOrderExampleStateSpace(double m, double k, double b, double dt) {
    StateSpace ss;
    ss.A.resize(2, 2);
    ss.B.resize(2, 1);
    ss.C.resize(1, 2);
    ss.D.resize(1, 1);

    const double inv_m = 1.0 / m;
    ss.A << 1.0, dt,
            -(k * inv_m) * dt, 1.0 - (b * inv_m) * dt;
    ss.B << 0.0,
            dt * inv_m;
    ss.C << 1.0, 0.0;
    ss.D << 0.0;
    return ss;
}

Eigen::MatrixXd ControllabilityMatrix(const StateSpace& ss) {
    const int n = static_cast<int>(ss.A.rows());
    const int m = static_cast<int>(ss.B.cols());
    Eigen::MatrixXd ctrb(ss.A.rows(), n * m);
    for (int i = 0; i < n; ++i) {
        ctrb.block(0, i * m, n, m) = MatrixPower(ss.A, i) * ss.B;
    }
    return ctrb;
}

Eigen::MatrixXd ObservabilityMatrix(const StateSpace& ss) {
    const int n = static_cast<int>(ss.A.rows());
    const int p = static_cast<int>(ss.C.rows());
    Eigen::MatrixXd obsv(n * p, n);
    for (int i = 0; i < n; ++i) {
        obsv.block(i * p, 0, p, n) = ss.C * MatrixPower(ss.A, i);
    }
    return obsv;
}

int MatrixRank(const Eigen::MatrixXd& matrix) {
    Eigen::FullPivLU<Eigen::MatrixXd> lu(matrix);
    const int max_dim = std::max(matrix.rows(), matrix.cols());
    lu.setThreshold(static_cast<double>(max_dim) * Eigen::NumTraits<double>::epsilon());
    return static_cast<int>(lu.rank());
}

bool IsControllable(const StateSpace& ss) {
    return MatrixRank(ControllabilityMatrix(ss)) == ss.A.rows();
}

bool IsObservable(const StateSpace& ss) {
    return MatrixRank(ObservabilityMatrix(ss)) == ss.A.rows();
}
