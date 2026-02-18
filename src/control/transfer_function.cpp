#include "transfer_function.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <limits>
#include <optional>

#include <Eigen/Dense>
#include <Eigen/Eigenvalues>

namespace {

constexpr double kEpsilon = 1e-12;
constexpr double kPi = 3.14159265358979323846;

std::complex<double> EvaluateZInversePolynomial(const std::vector<double>& coeffs, std::complex<double> z) {
    if (coeffs.empty()) {
        return {0.0, 0.0};
    }
    std::complex<double> acc = 0.0;
    std::complex<double> term = 1.0;
    for (double c : coeffs) {
        acc += c * term;
        term /= z;
    }
    return acc;
}

std::vector<double> TrimLeadingZeros(const std::vector<double>& coeffs) {
    std::size_t first_non_zero = 0;
    while (first_non_zero < coeffs.size() && std::abs(coeffs[first_non_zero]) < kEpsilon) {
        ++first_non_zero;
    }
    if (first_non_zero >= coeffs.size()) {
        return {};
    }
    return std::vector<double>(coeffs.begin() + static_cast<std::ptrdiff_t>(first_non_zero), coeffs.end());
}

std::vector<std::complex<double>> RootsFromZInverseCoeffs(const std::vector<double>& z_inverse_coeffs) {
    const std::vector<double> coeffs = TrimLeadingZeros(z_inverse_coeffs);
    if (coeffs.size() <= 1) {
        return {};
    }

    const int degree = static_cast<int>(coeffs.size()) - 1;
    const double leading = coeffs[0];
    if (std::abs(leading) < kEpsilon) {
        return {};
    }

    Eigen::MatrixXd companion = Eigen::MatrixXd::Zero(degree, degree);
    for (int i = 1; i < degree; ++i) {
        companion(i, i - 1) = 1.0;
    }
    for (int j = 0; j < degree; ++j) {
        companion(0, j) = -coeffs[j + 1] / leading;
    }

    Eigen::EigenSolver<Eigen::MatrixXd> solver(companion, false);
    const auto eigvals = solver.eigenvalues();

    std::vector<std::complex<double>> roots;
    roots.reserve(static_cast<std::size_t>(degree));
    for (int i = 0; i < degree; ++i) {
        roots.emplace_back(eigvals(i).real(), eigvals(i).imag());
    }
    return roots;
}

std::optional<double> FindCrossing(
    const std::vector<double>& x,
    const std::vector<double>& y,
    double target) {
    if (x.size() < 2 || y.size() < 2 || x.size() != y.size()) {
        return std::nullopt;
    }
    for (std::size_t i = 0; i + 1 < y.size(); ++i) {
        const double y1 = y[i] - target;
        const double y2 = y[i + 1] - target;
        if (std::abs(y1) < kEpsilon) {
            return x[i];
        }
        if (y1 * y2 <= 0.0 && std::abs(y2 - y1) > kEpsilon) {
            const double alpha = -y1 / (y2 - y1);
            return x[i] + alpha * (x[i + 1] - x[i]);
        }
    }
    return std::nullopt;
}

double InterpolateAt(const std::vector<double>& x, const std::vector<double>& y, double xq) {
    if (x.empty() || y.empty() || x.size() != y.size()) {
        return 0.0;
    }
    if (xq <= x.front()) {
        return y.front();
    }
    if (xq >= x.back()) {
        return y.back();
    }
    for (std::size_t i = 0; i + 1 < x.size(); ++i) {
        if (xq >= x[i] && xq <= x[i + 1]) {
            const double dx = x[i + 1] - x[i];
            if (std::abs(dx) < kEpsilon) {
                return y[i];
            }
            const double alpha = (xq - x[i]) / dx;
            return y[i] + alpha * (y[i + 1] - y[i]);
        }
    }
    return y.back();
}

} // namespace

std::complex<double> EvaluateUnitCircle(const TransferFunction& tf, double omega) {
    const std::complex<double> z = std::polar(1.0, omega);
    const std::complex<double> num = EvaluateZInversePolynomial(tf.num, z);
    const std::complex<double> den = EvaluateZInversePolynomial(tf.den, z);
    if (std::abs(den) < kEpsilon) {
        return {
            std::numeric_limits<double>::infinity(),
            std::numeric_limits<double>::infinity()
        };
    }
    return num / den;
}

std::vector<std::complex<double>> ComputeZeros(const TransferFunction& tf) {
    return RootsFromZInverseCoeffs(tf.num);
}

std::vector<std::complex<double>> ComputePoles(const TransferFunction& tf) {
    return RootsFromZInverseCoeffs(tf.den);
}

std::pair<std::vector<double>, std::vector<double>> ComputeBodeMagnitude(
    const TransferFunction& tf, int sample_count) {
    FrequencyResponseData response = ComputeFrequencyResponse(tf, sample_count);
    return {response.omega, response.magnitude_db};
}

FrequencyResponseData ComputeFrequencyResponse(const TransferFunction& tf, int sample_count) {
    const int n = std::max(2, sample_count);
    FrequencyResponseData response;
    response.omega.reserve(static_cast<std::size_t>(n));
    response.magnitude_db.reserve(static_cast<std::size_t>(n));
    response.phase_deg.reserve(static_cast<std::size_t>(n));

    double prev_phase_deg = 0.0;
    bool first = true;

    for (int i = 0; i < n; ++i) {
        const double w = kPi * static_cast<double>(i) / static_cast<double>(n - 1);
        const auto h = EvaluateUnitCircle(tf, w);
        const double mag = std::abs(h);
        const double db = 20.0 * std::log10(std::max(kEpsilon, mag));

        double phase_deg = std::atan2(h.imag(), h.real()) * 180.0 / kPi;
        if (!first) {
            while (phase_deg - prev_phase_deg > 180.0) {
                phase_deg -= 360.0;
            }
            while (phase_deg - prev_phase_deg < -180.0) {
                phase_deg += 360.0;
            }
        }

        response.omega.push_back(w);
        response.magnitude_db.push_back(db);
        response.phase_deg.push_back(phase_deg);
        prev_phase_deg = phase_deg;
        first = false;
    }
    return response;
}

StabilityMargins ComputeStabilityMargins(const FrequencyResponseData& response) {
    StabilityMargins margins;
    if (response.omega.size() < 2 || response.magnitude_db.size() < 2 || response.phase_deg.size() < 2) {
        return margins;
    }
    if (response.omega.size() != response.magnitude_db.size() ||
        response.omega.size() != response.phase_deg.size()) {
        return margins;
    }

    const auto w_gc = FindCrossing(response.omega, response.magnitude_db, 0.0);
    if (w_gc.has_value()) {
        margins.has_gain_crossover = true;
        margins.gain_crossover_rad = *w_gc;
        const double phase_at_gc = InterpolateAt(response.omega, response.phase_deg, *w_gc);
        margins.phase_margin_deg = 180.0 + phase_at_gc;
        margins.has_phase_margin = true;
    }

    const auto w_pc = FindCrossing(response.omega, response.phase_deg, -180.0);
    if (w_pc.has_value()) {
        margins.has_phase_crossover = true;
        margins.phase_crossover_rad = *w_pc;
        const double mag_at_pc = InterpolateAt(response.omega, response.magnitude_db, *w_pc);
        margins.gain_margin_db = -mag_at_pc;
        margins.has_gain_margin = true;
    }

    return margins;
}
