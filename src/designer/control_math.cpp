#include "control_math.h"

#include <algorithm>
#include <cmath>

#include <Eigen/Dense>

namespace designer {

std::vector<double> polynomial_from_real_roots_descending(const std::vector<double>& roots) {
    std::vector<double> p = {1.0};
    for (double r : roots) {
        std::vector<double> next(p.size() + 1, 0.0);
        for (std::size_t i = 0; i < p.size(); ++i) {
            next[i] += p[i];
            next[i + 1] += -r * p[i];
        }
        p.swap(next);
    }
    return p;
}

std::vector<std::complex<double>> roots_from_descending_coeffs(const std::vector<double>& coeffs) {
    std::vector<std::complex<double>> roots;
    if (coeffs.size() <= 1) {
        return roots;
    }
    if (std::abs(coeffs.front()) < 1e-12) {
        return roots;
    }
    const int n = static_cast<int>(coeffs.size()) - 1;
    Eigen::MatrixXd companion = Eigen::MatrixXd::Zero(n, n);
    for (int i = 0; i < n; ++i) {
        companion(0, i) = -coeffs[static_cast<std::size_t>(i + 1)] / coeffs.front();
    }
    for (int i = 1; i < n; ++i) {
        companion(i, i - 1) = 1.0;
    }
    Eigen::ComplexEigenSolver<Eigen::MatrixXd> es(companion, false);
    const auto eig = es.eigenvalues();
    roots.reserve(static_cast<std::size_t>(n));
    for (int i = 0; i < n; ++i) {
        roots.emplace_back(eig(i).real(), eig(i).imag());
    }
    return roots;
}

void generate_stable_plant_preset(int order, std::vector<double>& den, std::vector<double>& num) {
    const int n = std::max(1, order);

    std::vector<double> roots;
    roots.reserve(static_cast<std::size_t>(n));

    // Spread roots in (-0.85, 0.85) to keep discrete-time stability and avoid degeneracy.
    for (int i = 0; i < n; ++i) {
        const double t = (n == 1) ? 0.5 : static_cast<double>(i) / static_cast<double>(n - 1);
        const double r = -0.75 + 1.5 * t;
        roots.push_back(std::clamp(r, -0.85, 0.85));
    }

    const std::vector<double> poly = polynomial_from_real_roots_descending(roots);

    den.assign(static_cast<std::size_t>(n), 0.0);
    for (int i = 0; i < n; ++i) {
        den[static_cast<std::size_t>(i)] = poly[static_cast<std::size_t>(i + 1)];
    }

    num.assign(static_cast<std::size_t>(n), 0.0);
    const double base = 0.1 / static_cast<double>(n);
    for (int i = 0; i < n; ++i) {
        num[static_cast<std::size_t>(i)] = base;
    }
}

} // namespace designer
