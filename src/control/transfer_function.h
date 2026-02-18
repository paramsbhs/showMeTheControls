#pragma once

#include <complex>
#include <utility>
#include <vector>

struct TransferFunction {
    std::vector<double> num; // b0..bm in z^-1 form
    std::vector<double> den; // 1,a1..an in z^-1 form
};

struct FrequencyResponseData {
    std::vector<double> omega;
    std::vector<double> magnitude_db;
    std::vector<double> phase_deg;
};

struct StabilityMargins {
    bool has_gain_crossover = false;
    bool has_phase_crossover = false;
    bool has_phase_margin = false;
    bool has_gain_margin = false;
    double gain_crossover_rad = 0.0;
    double phase_crossover_rad = 0.0;
    double phase_margin_deg = 0.0;
    double gain_margin_db = 0.0;
};

std::complex<double> EvaluateUnitCircle(const TransferFunction& tf, double omega);
std::vector<std::complex<double>> ComputeZeros(const TransferFunction& tf);
std::vector<std::complex<double>> ComputePoles(const TransferFunction& tf);
std::pair<std::vector<double>, std::vector<double>> ComputeBodeMagnitude(
    const TransferFunction& tf, int sample_count);
FrequencyResponseData ComputeFrequencyResponse(const TransferFunction& tf, int sample_count);
StabilityMargins ComputeStabilityMargins(const FrequencyResponseData& response);
