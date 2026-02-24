#include <cmath>
#include <complex>
#include <iostream>
#include <vector>

#include "designer/block_designer.h"
#include "designer/control_math.h"

namespace {

bool approx_leq(double a, double b, double eps = 1e-9) {
    return a <= b + eps;
}

int test_presets_are_stable() {
    for (int n = 1; n <= 8; ++n) {
        std::vector<double> den;
        std::vector<double> num;
        designer::generate_stable_plant_preset(n, den, num);

        std::vector<double> poly;
        poly.reserve(static_cast<std::size_t>(n + 1));
        poly.push_back(1.0);
        poly.insert(poly.end(), den.begin(), den.end());

        const auto roots = designer::roots_from_descending_coeffs(poly);
        if (static_cast<int>(roots.size()) != n) {
            std::cerr << "preset root count mismatch for n=" << n << "\n";
            return 1;
        }
        for (const auto& r : roots) {
            if (!approx_leq(std::abs(r), 1.0)) {
                std::cerr << "unstable preset root for n=" << n << ": |r|=" << std::abs(r) << "\n";
                return 1;
            }
        }
    }
    return 0;
}

int test_plant_block_finite_response() {
    designer::PlantBlock p;
    p.set_order(4);

    designer::Signal u;
    designer::Signal y;
    p.inputs = {&u};
    p.outputs = {&y};

    for (int k = 0; k < 3000; ++k) {
        u.value = 1.0;
        p.step(0.001);
        if (!std::isfinite(y.value)) {
            std::cerr << "non-finite plant output at k=" << k << "\n";
            return 1;
        }
    }
    return 0;
}

int test_closed_loop_polynomial_order_consistency() {
    const int n = 6;
    std::vector<double> den;
    std::vector<double> num;
    designer::generate_stable_plant_preset(n, den, num);

    const double K = 3.5;
    std::vector<double> cl(static_cast<std::size_t>(n + 1), 0.0);
    cl[0] = 1.0;
    for (int i = 0; i < n; ++i) {
        cl[static_cast<std::size_t>(i + 1)] = den[static_cast<std::size_t>(i)] + K * num[static_cast<std::size_t>(i)];
    }

    const auto roots = designer::roots_from_descending_coeffs(cl);
    if (static_cast<int>(roots.size()) != n) {
        std::cerr << "closed-loop root count mismatch\n";
        return 1;
    }
    return 0;
}

} // namespace

int main() {
    const int r1 = test_presets_are_stable();
    const int r2 = test_plant_block_finite_response();
    const int r3 = test_closed_loop_polynomial_order_consistency();

    if (r1 || r2 || r3) {
        return 1;
    }
    std::cout << "All designer tests passed.\n";
    return 0;
}
