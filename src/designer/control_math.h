#pragma once

#include <complex>
#include <vector>

namespace designer {

std::vector<double> polynomial_from_real_roots_descending(const std::vector<double>& roots);
std::vector<std::complex<double>> roots_from_descending_coeffs(const std::vector<double>& coeffs);

void generate_stable_plant_preset(int order, std::vector<double>& den, std::vector<double>& num);

} // namespace designer
