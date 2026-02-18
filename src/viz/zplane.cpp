#include "zplane.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <string>

#include <imgui.h>
#include <implot.h>

namespace {

struct TransferFunctionPreset {
    const char* name;
    std::vector<double> num;
    std::vector<double> den;
};

const std::array<TransferFunctionPreset, 4> kPresets = {{
    {"Custom", {0.05, 0.1, 0.05}, {1.0, -1.4, 0.49}},
    {"1st-order low-pass", {0.1, 0.0}, {1.0, -0.9}},
    {"Notch near pi/2", {1.0, 0.0, 1.0}, {1.0, -0.2, 0.64}},
    {"Resonator", {0.1}, {1.0, -1.6, 0.81}}
}};

TransferFunction BuildTransferFunction(const TransferFunctionVizState& state) {
    TransferFunction tf;
    tf.num = state.num;
    tf.den = state.den;
    return tf;
}

void ResizeCoefficients(std::vector<double>& coeffs, int order, double fill_value) {
    coeffs.resize(static_cast<std::size_t>(order + 1), fill_value);
}

void DrawCoefficientInputs(const char* label, std::vector<double>& coeffs, const char* id_prefix) {
    ImGui::Text("%s", label);
    for (std::size_t i = 0; i < coeffs.size(); ++i) {
        std::string field_label = std::string(id_prefix) + "[" + std::to_string(i) + "]";
        ImGui::PushID(static_cast<int>(i));
        ImGui::SetNextItemWidth(110.0f);
        ImGui::InputDouble(field_label.c_str(), &coeffs[i], 0.0, 0.0, "%.6f");
        if (i + 1 < coeffs.size()) {
            ImGui::SameLine();
        }
        ImGui::PopID();
    }
}

void SplitComplexPoints(
    const std::vector<std::complex<double>>& points,
    std::vector<double>& xs,
    std::vector<double>& ys) {
    xs.clear();
    ys.clear();
    xs.reserve(points.size());
    ys.reserve(points.size());
    for (const auto& p : points) {
        xs.push_back(p.real());
        ys.push_back(p.imag());
    }
}

void DrawPointLabels(const std::vector<std::complex<double>>& points, const char* label) {
    for (const auto& p : points) {
        ImPlot::PlotText(label, p.real(), p.imag(), ImVec2(2.0f, -2.0f));
    }
}

void UpdateAnalysis(TransferFunctionVizState& state) {
    const TransferFunction tf = BuildTransferFunction(state);
    state.zeros = ComputeZeros(tf);
    state.poles = ComputePoles(tf);
    const auto response = ComputeFrequencyResponse(tf, state.bode_samples);
    state.omega = response.omega;
    state.mag_db = response.magnitude_db;
    state.phase_deg = response.phase_deg;
    state.margins = ComputeStabilityMargins(response);
}

void ApplyPreset(TransferFunctionVizState& state, int preset_index) {
    const int clamped = std::clamp(preset_index, 0, static_cast<int>(kPresets.size()) - 1);
    const auto& preset = kPresets[static_cast<std::size_t>(clamped)];
    state.num = preset.num;
    state.den = preset.den;
    state.num_order = static_cast<int>(state.num.size()) - 1;
    state.den_order = static_cast<int>(state.den.size()) - 1;
    state.preset_index = clamped;
}

} // namespace

void DrawTransferFunctionPanel(TransferFunctionVizState& state) {
    ImGui::Begin("Transfer Function");
    ImGui::Text("H(z) = (b0 + b1 z^-1 + ... + bm z^-m) / (1 + a1 z^-1 + ... + an z^-n)");

    bool shape_changed = false;
    shape_changed |= ImGui::SliderInt("Num order m", &state.num_order, 0, 8);
    shape_changed |= ImGui::SliderInt("Den order n", &state.den_order, 1, 8);
    shape_changed |= ImGui::SliderInt("Bode samples", &state.bode_samples, 64, 2048);
    ImGui::Checkbox("Auto-fit Z-plane", &state.auto_fit);

    if (ImGui::BeginCombo("Preset", kPresets[static_cast<std::size_t>(state.preset_index)].name)) {
        for (int i = 0; i < static_cast<int>(kPresets.size()); ++i) {
            const bool selected = (state.preset_index == i);
            if (ImGui::Selectable(kPresets[static_cast<std::size_t>(i)].name, selected)) {
                ApplyPreset(state, i);
            }
            if (selected) {
                ImGui::SetItemDefaultFocus();
            }
        }
        ImGui::EndCombo();
    }

    if (shape_changed) {
        ResizeCoefficients(state.num, state.num_order, 0.0);
        ResizeCoefficients(state.den, state.den_order, 0.0);
        if (!state.den.empty() && std::abs(state.den[0]) < 1e-12) {
            state.den[0] = 1.0;
        }
    }

    DrawCoefficientInputs("Numerator coefficients b[i]", state.num, "b");
    DrawCoefficientInputs("Denominator coefficients a[i] (a[0] should be 1)", state.den, "a");

    if (!state.den.empty() && std::abs(state.den[0]) < 1e-12) {
        ImGui::TextColored(ImVec4(1.0f, 0.5f, 0.3f, 1.0f), "Warning: a[0] must be non-zero.");
    }

    if (ImGui::Button("Normalize a[0] to 1") && !state.den.empty() && std::abs(state.den[0]) > 1e-12) {
        const double scale = state.den[0];
        for (double& c : state.den) {
            c /= scale;
        }
        for (double& c : state.num) {
            c /= scale;
        }
    }

    UpdateAnalysis(state);

    ImGui::Separator();
    ImGui::Text("Frequency-domain metrics");
    if (state.margins.has_gain_crossover) {
        ImGui::Text("Gain crossover w_gc: %.4f rad/sample", state.margins.gain_crossover_rad);
    } else {
        ImGui::Text("Gain crossover w_gc: none");
    }
    if (state.margins.has_phase_crossover) {
        ImGui::Text("Phase crossover w_pc: %.4f rad/sample", state.margins.phase_crossover_rad);
    } else {
        ImGui::Text("Phase crossover w_pc: none");
    }
    if (state.margins.has_phase_margin) {
        ImGui::Text("Phase margin: %.2f deg", state.margins.phase_margin_deg);
    } else {
        ImGui::Text("Phase margin: n/a");
    }
    if (state.margins.has_gain_margin) {
        ImGui::Text("Gain margin: %.2f dB", state.margins.gain_margin_db);
    } else {
        ImGui::Text("Gain margin: n/a");
    }

    std::vector<double> zeros_x;
    std::vector<double> zeros_y;
    std::vector<double> poles_x;
    std::vector<double> poles_y;
    SplitComplexPoints(state.zeros, zeros_x, zeros_y);
    SplitComplexPoints(state.poles, poles_x, poles_y);

    constexpr int kCirclePoints = 256;
    std::array<double, kCirclePoints> circle_x{};
    std::array<double, kCirclePoints> circle_y{};
    for (int i = 0; i < kCirclePoints; ++i) {
        const double theta = 2.0 * 3.14159265358979323846 * static_cast<double>(i) / static_cast<double>(kCirclePoints - 1);
        circle_x[static_cast<std::size_t>(i)] = std::cos(theta);
        circle_y[static_cast<std::size_t>(i)] = std::sin(theta);
    }

    if (ImPlot::BeginPlot("Z-Plane Pole/Zero Map", ImVec2(-1.0f, 320.0f), ImPlotFlags_Equal)) {
        ImPlot::SetupAxes("Re{z}", "Im{z}");
        if (!state.auto_fit) {
            ImPlot::SetupAxisLimits(ImAxis_X1, -2.0, 2.0, ImGuiCond_Always);
            ImPlot::SetupAxisLimits(ImAxis_Y1, -2.0, 2.0, ImGuiCond_Always);
        }

        ImPlot::PlotLine("Unit Circle", circle_x.data(), circle_y.data(), kCirclePoints);
        if (!zeros_x.empty()) {
            ImPlot::PlotScatter("Zeros", zeros_x.data(), zeros_y.data(), static_cast<int>(zeros_x.size()),
                                ImPlotSpec(ImPlotProp_Marker, ImPlotMarker_Circle, ImPlotProp_MarkerSize, 6.0f));
            DrawPointLabels(state.zeros, "o");
        }
        if (!poles_x.empty()) {
            ImPlot::PlotScatter("Poles", poles_x.data(), poles_y.data(), static_cast<int>(poles_x.size()),
                                ImPlotSpec(ImPlotProp_Marker, ImPlotMarker_Cross, ImPlotProp_MarkerSize, 6.0f, ImPlotProp_LineWeight, 2.0f));
            DrawPointLabels(state.poles, "x");
        }
        ImPlot::EndPlot();
    }

    if (ImPlot::BeginPlot("Bode Magnitude |H(e^{jw})| (dB)", ImVec2(-1.0f, 260.0f))) {
        ImPlot::SetupAxes("w (rad/sample)", "Magnitude (dB)");
        if (!state.omega.empty() && !state.mag_db.empty()) {
            ImPlot::PlotLine("Magnitude", state.omega.data(), state.mag_db.data(), static_cast<int>(state.omega.size()));
            if (state.margins.has_gain_crossover) {
                const double x = state.margins.gain_crossover_rad;
                const double y = 0.0;
                ImPlot::PlotScatter("w_gc", &x, &y, 1,
                                    ImPlotSpec(ImPlotProp_Marker, ImPlotMarker_Diamond, ImPlotProp_MarkerSize, 7.0f));
            }
            if (state.margins.has_phase_crossover) {
                const double x = state.margins.phase_crossover_rad;
                const double y = -state.margins.gain_margin_db;
                ImPlot::PlotScatter("w_pc", &x, &y, 1,
                                    ImPlotSpec(ImPlotProp_Marker, ImPlotMarker_Square, ImPlotProp_MarkerSize, 7.0f));
            }
        }
        ImPlot::EndPlot();
    }

    if (ImPlot::BeginPlot("Bode Phase angle(H(e^{jw})) (deg)", ImVec2(-1.0f, 220.0f))) {
        ImPlot::SetupAxes("w (rad/sample)", "Phase (deg)");
        if (!state.omega.empty() && !state.phase_deg.empty()) {
            ImPlot::PlotLine("Phase", state.omega.data(), state.phase_deg.data(), static_cast<int>(state.omega.size()));
            if (state.margins.has_phase_crossover) {
                const double x = state.margins.phase_crossover_rad;
                const double y = -180.0;
                ImPlot::PlotScatter("phase crossover", &x, &y, 1,
                                    ImPlotSpec(ImPlotProp_Marker, ImPlotMarker_Diamond, ImPlotProp_MarkerSize, 7.0f));
            }
            if (state.margins.has_gain_crossover) {
                const double x = state.margins.gain_crossover_rad;
                char label[64] = {};
                std::snprintf(label, sizeof(label), "PM %.1f deg", state.margins.phase_margin_deg);
                const double y = -180.0 + state.margins.phase_margin_deg;
                ImPlot::PlotScatter("gain crossover", &x, &y, 1,
                                    ImPlotSpec(ImPlotProp_Marker, ImPlotMarker_Square, ImPlotProp_MarkerSize, 7.0f));
                ImPlot::PlotText(label, x, y, ImVec2(4.0f, -6.0f));
            }
        }
        ImPlot::EndPlot();
    }

    ImGui::End();
}
