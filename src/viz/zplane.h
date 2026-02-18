#pragma once

#include <complex>
#include <vector>

#include "control/transfer_function.h"

struct TransferFunctionVizState {
    int num_order = 2;
    int den_order = 2;
    int bode_samples = 512;
    bool auto_fit = false;
    int preset_index = 0;

    std::vector<double> num = {0.05, 0.1, 0.05};
    std::vector<double> den = {1.0, -1.4, 0.49};

    std::vector<std::complex<double>> zeros;
    std::vector<std::complex<double>> poles;
    std::vector<double> omega;
    std::vector<double> mag_db;
    std::vector<double> phase_deg;
    StabilityMargins margins;
};

void DrawTransferFunctionPanel(TransferFunctionVizState& state);
