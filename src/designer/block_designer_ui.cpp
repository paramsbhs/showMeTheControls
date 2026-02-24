#include "block_designer.h"
#include "control_math.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <string>
#include <vector>

#include <imgui.h>
#include <implot.h>

namespace designer {

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr float kNodeWidth = 170.0f;
constexpr float kNodeHeaderHeight = 28.0f;
constexpr float kNodePinSpacing = 18.0f;
constexpr float kNodePadding = 8.0f;
constexpr float kPinRadius = 4.0f;
constexpr float kPinPickRadius = 9.0f;
constexpr float kGridStep = 32.0f;

} // namespace

void BlockDesigner::render_toolbar() {
    ImGui::Text("Simulink-style controller designer");
    ImGui::Checkbox("Run", &run_sim_);

    if (ImGui::Button("Reset Simulation")) {
        reset_simulation();
    }
    ImGui::SameLine();
    if (ImGui::Button("Reset Graph Views")) {
        reset_graph_views();
    }
    ImGui::SameLine();
    if (ImGui::Button("Recompute K Sweep")) {
        recompute_sweep();
    }

    const double k_min = 0.0;
    const double k_max = 100.0;
    const double k_sweep_min = 1.0;
    const double k_sweep_max_limit = 1000.0;
    ImGui::SliderScalar("K (controller gain)", ImGuiDataType_Double, &k_gain_, &k_min, &k_max, "%.3f");
    const bool sweep_max_changed =
        ImGui::SliderScalar("K max for sweep", ImGuiDataType_Double, &k_sweep_max_, &k_sweep_min, &k_sweep_max_limit, "%.1f");
    const bool sweep_samples_changed = ImGui::SliderInt("Sweep samples", &k_sweep_samples_, 20, 1000);
    if (sweep_max_changed || sweep_samples_changed) {
        recompute_sweep();
    }
    if (ImGui::Checkbox("Manual open-loop root-locus mode", &use_manual_open_loop_)) {
        recompute_sweep();
    }
    if (use_manual_open_loop_) {
        bool changed = false;
        int den_deg = manual_den_degree_;
        int num_deg = manual_num_degree_;
        if (ImGui::SliderInt("Den degree", &den_deg, 1, 8)) {
            manual_den_degree_ = den_deg;
            manual_num_degree_ = std::min(manual_num_degree_, manual_den_degree_);
            resize_poly_desc(manual_den_desc_, manual_den_degree_);
            resize_poly_desc(manual_num_desc_, manual_num_degree_);
            changed = true;
        }
        if (ImGui::SliderInt("Num degree", &num_deg, 0, 8)) {
            manual_num_degree_ = std::min(num_deg, manual_den_degree_);
            resize_poly_desc(manual_num_desc_, manual_num_degree_);
            changed = true;
        }
        if (ImGui::Button("Load Example: z/((z-0.6)(z-1.2))")) {
            manual_den_degree_ = 2;
            manual_num_degree_ = 1;
            manual_den_desc_ = {1.0, -1.8, 0.72};
            manual_num_desc_ = {1.0, 0.0};
            changed = true;
        }
        ImGui::TextWrapped("Open-loop form: G(z) = N(z) / D(z), root locus from D(z)+K N(z)=0.");
        ImGui::TextWrapped("Enter coefficients in descending powers of z.");
        for (int i = 0; i <= manual_den_degree_; ++i) {
            const std::string label = "D[" + std::to_string(i) + "]";
            if (ImGui::InputDouble(label.c_str(), &manual_den_desc_[static_cast<std::size_t>(i)], 0.0, 0.0, "%.6f")) {
                changed = true;
            }
        }
        for (int i = 0; i <= manual_num_degree_; ++i) {
            const std::string label = "N[" + std::to_string(i) + "]";
            if (ImGui::InputDouble(label.c_str(), &manual_num_desc_[static_cast<std::size_t>(i)], 0.0, 0.0, "%.6f")) {
                changed = true;
            }
        }
        if (changed) {
            recompute_sweep();
        }
    }
    ImGui::SliderScalar("Response window (s)", ImGuiDataType_Double, &response_window_seconds_, &k_sweep_min, &k_sweep_max_limit, "%.1f");
    const double pole_range_min = 0.5;
    const double pole_range_max = 50.0;
    ImGui::SliderScalar("Pole plot range", ImGuiDataType_Double, &pole_plot_range_, &pole_range_min, &pole_range_max, "%.2f");

    PlantBlock* first_plant = nullptr;
    for (const auto& b : diagram_.blocks) {
        first_plant = dynamic_cast<PlantBlock*>(b.get());
        if (first_plant) {
            break;
        }
    }

    if (first_plant && ImGui::CollapsingHeader("Plant Parameters", ImGuiTreeNodeFlags_DefaultOpen)) {
        int order = first_plant->order;
        bool changed = false;
        if (ImGui::SliderInt("Order n", &order, 1, 8)) {
            first_plant->set_order(order);
            changed = true;
        }
        ImGui::SameLine();
        if (ImGui::Button("Generate Stable Preset")) {
            generate_stable_plant_preset(first_plant->order, first_plant->den, first_plant->num);
            changed = true;
        }

        ImGui::TextWrapped("Difference equation form:");
        ImGui::TextWrapped("y[k] + a1 y[k-1] + ... + an y[k-n] = b0 u[k-1] + ... + b(n-1) u[k-n]");

        for (int i = 0; i < first_plant->order; ++i) {
            const std::string label = "a" + std::to_string(i + 1);
            if (ImGui::InputDouble(label.c_str(), &first_plant->den[static_cast<std::size_t>(i)], 0.0, 0.0, "%.6f")) {
                changed = true;
            }
        }
        for (int i = 0; i < first_plant->order; ++i) {
            const std::string label = "b" + std::to_string(i);
            if (ImGui::InputDouble(label.c_str(), &first_plant->num[static_cast<std::size_t>(i)], 0.0, 0.0, "%.6f")) {
                changed = true;
            }
        }

        if (changed) {
            rebuild_signals_from_connections();
            reset_simulation();
        }
    }

    int disconnected_inputs = 0;
    int disconnected_outputs = 0;
    for (const auto& b : diagram_.blocks) {
        for (Signal* s : b->inputs) {
            if (!s) {
                disconnected_inputs += 1;
            }
        }
        for (Signal* s : b->outputs) {
            if (!s) {
                disconnected_outputs += 1;
            }
        }
    }

    ImGui::Separator();
    ImGui::TextWrapped("%s", diagram_.schedule_message.c_str());
    if (diagram_.has_cycle) {
        ImGui::TextColored(ImVec4(1.0f, 0.45f, 0.35f, 1.0f), "Cycle detected: simulation stepping paused until resolved.");
    } else {
        ImGui::TextColored(ImVec4(0.45f, 0.9f, 0.45f, 1.0f), "No cycle detected.");
    }
    ImGui::Text("Disconnected inputs: %d", disconnected_inputs);
    ImGui::Text("Disconnected outputs: %d", disconnected_outputs);
}

void BlockDesigner::render_block_editor_window() {
    ImGui::TextWrapped("Drag blocks to arrange the diagram. Click an output pin, then an input pin, to create a wire.");
    if (ImGui::Button("Add Constant")) {
        add_block(NewBlockType::Constant);
    }
    ImGui::SameLine();
    if (ImGui::Button("Add Sum")) {
        add_block(NewBlockType::Sum);
    }
    ImGui::SameLine();
    if (ImGui::Button("Add Gain")) {
        add_block(NewBlockType::Gain);
    }
    ImGui::SameLine();
    if (ImGui::Button("Add Plant")) {
        add_block(NewBlockType::FirstOrderPlant);
    }
    ImGui::SameLine();
    if (ImGui::Button("Add Scope")) {
        add_block(NewBlockType::Scope);
    }

    if (selected_block_ >= 0 && static_cast<std::size_t>(selected_block_) < diagram_.blocks.size()) {
        const int selected_before_remove = selected_block_;
        const std::string selected_name = diagram_.blocks[static_cast<std::size_t>(selected_block_)]->name;
        ImGui::SameLine();
        if (ImGui::Button("Remove Selected Block")) {
            remove_block(selected_before_remove);
        }
        if (selected_block_ >= 0 && static_cast<std::size_t>(selected_block_) < diagram_.blocks.size()) {
            ImGui::Text("Selected: %s", diagram_.blocks[static_cast<std::size_t>(selected_block_)]->name.c_str());
        } else {
            ImGui::Text("Selected: %s (removed)", selected_name.c_str());
        }
    }

    if (ImGui::Button("Clear All Wires")) {
        diagram_.connections.clear();
        pending_link_from_block_ = -1;
        pending_link_from_pin_ = -1;
        rebuild_signals_from_connections();
    }
    ImGui::SameLine();
    ImGui::Text("%s", pending_link_from_block_ >= 0 ? "Wiring: select input pin" : "Wiring: idle");

    ImGui::Separator();

    const ImVec2 canvas_size = ImGui::GetContentRegionAvail();
    ImGui::BeginChild("DesignerCanvas", canvas_size, true, ImGuiWindowFlags_NoScrollWithMouse | ImGuiWindowFlags_NoScrollbar);

    ImDrawList* draw = ImGui::GetWindowDrawList();
    const ImVec2 canvas_origin = ImGui::GetCursorScreenPos();
    const ImVec2 canvas_min = ImGui::GetWindowPos();
    const ImVec2 canvas_max = ImVec2(canvas_min.x + ImGui::GetWindowSize().x, canvas_min.y + ImGui::GetWindowSize().y);

    for (float x = std::fmod(canvas_origin.x, kGridStep); x < canvas_max.x; x += kGridStep) {
        draw->AddLine(ImVec2(x, canvas_min.y), ImVec2(x, canvas_max.y), IM_COL32(60, 60, 60, 60), 1.0f);
    }
    for (float y = std::fmod(canvas_origin.y, kGridStep); y < canvas_max.y; y += kGridStep) {
        draw->AddLine(ImVec2(canvas_min.x, y), ImVec2(canvas_max.x, y), IM_COL32(60, 60, 60, 60), 1.0f);
    }

    if (node_views_.size() < diagram_.blocks.size()) {
        node_views_.resize(diagram_.blocks.size());
    }

    auto node_height_for = [&](const Block& block) {
        const int pin_rows = static_cast<int>(std::max(block.inputs.size(), block.outputs.size()));
        return kNodeHeaderHeight + 2.0f * kNodePadding + kNodePinSpacing * static_cast<float>(std::max(1, pin_rows));
    };

    auto input_pin_pos = [&](std::size_t block_idx, int pin_idx) {
        const NodeView& n = node_views_[block_idx];
        const float y = n.y + kNodeHeaderHeight + kNodePadding + kNodePinSpacing * static_cast<float>(pin_idx) + 0.5f * kNodePinSpacing;
        return ImVec2(canvas_origin.x + n.x, canvas_origin.y + y);
    };

    auto output_pin_pos = [&](std::size_t block_idx, int pin_idx) {
        const NodeView& n = node_views_[block_idx];
        const float y = n.y + kNodeHeaderHeight + kNodePadding + kNodePinSpacing * static_cast<float>(pin_idx) + 0.5f * kNodePinSpacing;
        return ImVec2(canvas_origin.x + n.x + kNodeWidth, canvas_origin.y + y);
    };

    const ImVec2 mouse = ImGui::GetIO().MousePos;
    int hovered_input_block = -1;
    int hovered_input_pin = -1;
    int hovered_output_block = -1;
    int hovered_output_pin = -1;

    for (const Connection& c : diagram_.connections) {
        if (c.from_block < 0 || c.to_block < 0) {
            continue;
        }
        const std::size_t from = static_cast<std::size_t>(c.from_block);
        const std::size_t to = static_cast<std::size_t>(c.to_block);
        if (from >= diagram_.blocks.size() || to >= diagram_.blocks.size()) {
            continue;
        }

        const ImVec2 p0 = output_pin_pos(from, c.from_pin);
        const ImVec2 p3 = input_pin_pos(to, c.to_pin);
        const float dx = std::max(40.0f, std::abs(p3.x - p0.x) * 0.5f);
        draw->AddBezierCubic(p0, ImVec2(p0.x + dx, p0.y), ImVec2(p3.x - dx, p3.y), p3, IM_COL32(140, 200, 255, 200), 2.0f);
    }

    if (pending_link_from_block_ >= 0 && pending_link_from_pin_ >= 0
        && static_cast<std::size_t>(pending_link_from_block_) < diagram_.blocks.size()) {
        const ImVec2 p0 = output_pin_pos(static_cast<std::size_t>(pending_link_from_block_), pending_link_from_pin_);
        const ImVec2 p3 = mouse;
        const float dx = std::max(40.0f, std::abs(p3.x - p0.x) * 0.5f);
        draw->AddBezierCubic(p0, ImVec2(p0.x + dx, p0.y), ImVec2(p3.x - dx, p3.y), p3, IM_COL32(255, 220, 120, 230), 2.0f);
    }

    for (std::size_t i = 0; i < diagram_.blocks.size(); ++i) {
        const Block& block = *diagram_.blocks[i];
        NodeView& n = node_views_[i];
        const float h = node_height_for(block);
        const ImVec2 node_min(canvas_origin.x + n.x, canvas_origin.y + n.y);
        const ImVec2 node_max(node_min.x + kNodeWidth, node_min.y + h);
        const ImVec2 header_max(node_max.x, node_min.y + kNodeHeaderHeight);

        ImGui::SetCursorScreenPos(node_min);
        ImGui::InvisibleButton(("node_btn_" + std::to_string(i)).c_str(), ImVec2(kNodeWidth, h));
        const bool hovered = ImGui::IsItemHovered();
        const bool active = ImGui::IsItemActive();

        bool pin_hovered_for_this_node = false;
        for (std::size_t pin = 0; pin < block.inputs.size(); ++pin) {
            const ImVec2 p = input_pin_pos(i, static_cast<int>(pin));
            const float dx = mouse.x - p.x;
            const float dy = mouse.y - p.y;
            if ((dx * dx + dy * dy) <= (kPinPickRadius * kPinPickRadius)) {
                pin_hovered_for_this_node = true;
            }
        }
        for (std::size_t pin = 0; pin < block.outputs.size(); ++pin) {
            const ImVec2 p = output_pin_pos(i, static_cast<int>(pin));
            const float dx = mouse.x - p.x;
            const float dy = mouse.y - p.y;
            if ((dx * dx + dy * dy) <= (kPinPickRadius * kPinPickRadius)) {
                pin_hovered_for_this_node = true;
            }
        }

        if (ImGui::IsItemClicked(ImGuiMouseButton_Left)) {
            selected_block_ = static_cast<int>(i);
        }
        if (ImGui::IsItemActivated() && !pin_hovered_for_this_node) {
            dragging_block_ = static_cast<int>(i);
            drag_offset_x_ = mouse.x - node_min.x;
            drag_offset_y_ = mouse.y - node_min.y;
        }

        if (dragging_block_ == static_cast<int>(i) && ImGui::IsMouseDown(ImGuiMouseButton_Left)) {
            n.x = mouse.x - canvas_origin.x - drag_offset_x_;
            n.y = mouse.y - canvas_origin.y - drag_offset_y_;
        }
        if (dragging_block_ == static_cast<int>(i) && ImGui::IsMouseReleased(ImGuiMouseButton_Left)) {
            dragging_block_ = -1;
        }

        const bool selected = static_cast<int>(i) == selected_block_;
        const ImU32 fill = active ? IM_COL32(52, 72, 96, 240) : IM_COL32(36, 44, 58, 230);
        const ImU32 border = selected ? IM_COL32(255, 220, 90, 255)
            : hovered          ? IM_COL32(130, 190, 255, 255)
                               : IM_COL32(120, 120, 130, 180);
        draw->AddRectFilled(node_min, node_max, fill, 6.0f);
        draw->AddRectFilled(node_min, header_max, IM_COL32(62, 88, 118, 255), 6.0f, ImDrawFlags_RoundCornersTop);
        draw->AddRect(node_min, node_max, border, 6.0f, 0, selected ? 2.5f : (hovered ? 2.0f : 1.0f));
        draw->AddText(ImVec2(node_min.x + 10.0f, node_min.y + 7.0f), IM_COL32(240, 240, 245, 255), block.name.c_str());

        for (std::size_t pin = 0; pin < block.inputs.size(); ++pin) {
            const ImVec2 p = input_pin_pos(i, static_cast<int>(pin));
            const float dx = mouse.x - p.x;
            const float dy = mouse.y - p.y;
            const bool pin_hovered = (dx * dx + dy * dy) <= (kPinPickRadius * kPinPickRadius);
            if (pin_hovered) {
                hovered_input_block = static_cast<int>(i);
                hovered_input_pin = static_cast<int>(pin);
            }
            draw->AddCircleFilled(p, pin_hovered ? (kPinRadius + 1.5f) : kPinRadius, IM_COL32(220, 150, 100, 240));
        }
        for (std::size_t pin = 0; pin < block.outputs.size(); ++pin) {
            const ImVec2 p = output_pin_pos(i, static_cast<int>(pin));
            const float dx = mouse.x - p.x;
            const float dy = mouse.y - p.y;
            const bool pin_hovered = (dx * dx + dy * dy) <= (kPinPickRadius * kPinPickRadius);
            if (pin_hovered) {
                hovered_output_block = static_cast<int>(i);
                hovered_output_pin = static_cast<int>(pin);
            }
            draw->AddCircleFilled(p, pin_hovered ? (kPinRadius + 1.5f) : kPinRadius, IM_COL32(120, 210, 140, 240));
        }
    }

    if (ImGui::IsMouseClicked(ImGuiMouseButton_Left)) {
        if (hovered_output_block >= 0) {
            pending_link_from_block_ = hovered_output_block;
            pending_link_from_pin_ = hovered_output_pin;
            dragging_block_ = -1;
        } else if (pending_link_from_block_ >= 0 && hovered_input_block >= 0) {
            diagram_.connections.erase(
                std::remove_if(
                    diagram_.connections.begin(),
                    diagram_.connections.end(),
                    [&](const Connection& c) {
                        return c.to_block == hovered_input_block && c.to_pin == hovered_input_pin;
                    }),
                diagram_.connections.end());
            diagram_.connections.push_back({
                pending_link_from_block_,
                pending_link_from_pin_,
                hovered_input_block,
                hovered_input_pin});
            pending_link_from_block_ = -1;
            pending_link_from_pin_ = -1;
            rebuild_signals_from_connections();
        } else if (pending_link_from_block_ >= 0) {
            pending_link_from_block_ = -1;
            pending_link_from_pin_ = -1;
        }
    }

    if (ImGui::IsMouseClicked(ImGuiMouseButton_Right)) {
        if (hovered_input_block >= 0) {
            diagram_.connections.erase(
                std::remove_if(
                    diagram_.connections.begin(),
                    diagram_.connections.end(),
                    [&](const Connection& c) {
                        return c.to_block == hovered_input_block && c.to_pin == hovered_input_pin;
                    }),
                diagram_.connections.end());
            rebuild_signals_from_connections();
        } else {
            pending_link_from_block_ = -1;
            pending_link_from_pin_ = -1;
        }
    }

    ImGui::EndChild();
}

void BlockDesigner::render_time_plot_window() {
    if (output_scope_ && ImPlot::BeginPlot("y(t)")) {
        ImPlot::SetupAxes("t (s)", "y");
        if (!output_scope_->tlog.empty()) {
            const int n = static_cast<int>(output_scope_->tlog.size());
            const double t_end = output_scope_->tlog.back();
            const double t_start = std::max(0.0, t_end - std::max(1.0, response_window_seconds_));

            int first = 0;
            while (first + 1 < n && output_scope_->tlog[static_cast<std::size_t>(first)] < t_start) {
                ++first;
            }
            const int count = std::max(1, n - first);

            double y_min = output_scope_->ylog[static_cast<std::size_t>(first)];
            double y_max = y_min;
            for (int i = first; i < n; ++i) {
                const double y = output_scope_->ylog[static_cast<std::size_t>(i)];
                y_min = std::min(y_min, y);
                y_max = std::max(y_max, y);
            }
            const double y_pad = std::max(0.05, 0.1 * std::max(1e-6, y_max - y_min));
            ImPlot::SetupAxisLimits(ImAxis_X1, t_start, t_end + 0.001, ImGuiCond_Always);
            ImPlot::SetupAxisLimits(ImAxis_Y1, y_min - y_pad, y_max + y_pad, ImGuiCond_Always);
            ImPlot::PlotLine(
                "Output y",
                output_scope_->tlog.data() + first,
                output_scope_->ylog.data() + first,
                count);
        }
        ImPlot::EndPlot();
    }
    if (!output_scope_) {
        ImGui::TextWrapped("No scope block available. Add a Scope block and wire it to a signal.");
    }
}

void BlockDesigner::render_gain_sweep_window() {
    ImGui::Text("Root locus with K sampled from 0 to Kmax.");
    if (!use_manual_open_loop_ && !extracted_model_.valid) {
        ImGui::TextColored(ImVec4(1.0f, 0.45f, 0.35f, 1.0f), "Sweep unavailable: %s", extracted_model_.message.c_str());
        return;
    }

    if (ImPlot::BeginPlot("Pole Trajectories", ImVec2(-1.0f, 380.0f), ImPlotFlags_Equal)) {
        ImPlot::SetupAxes("Re", "Im");
        std::size_t best = 0;
        if (!trajectory_.k_values.empty()) {
            double best_err = std::abs(trajectory_.k_values[0] - k_gain_);
            for (std::size_t i = 1; i < trajectory_.k_values.size(); ++i) {
                const double err = std::abs(trajectory_.k_values[i] - k_gain_);
                if (err < best_err) {
                    best_err = err;
                    best = i;
                }
            }
        }

        // Focus on local neighborhood around current K so one far pole does not destroy zoom.
        double local_abs = 1.2;
        if (!trajectory_.poles_per_k.empty()) {
            const std::size_t w = std::max<std::size_t>(4, trajectory_.poles_per_k.size() / 25);
            const std::size_t i0 = (best > w) ? (best - w) : 0;
            const std::size_t i1 = std::min(trajectory_.poles_per_k.size(), best + w + 1);
            for (std::size_t i = i0; i < i1; ++i) {
                for (const auto& p : trajectory_.poles_per_k[i]) {
                    local_abs = std::max(local_abs, std::abs(p.real()) + 0.2);
                    local_abs = std::max(local_abs, std::abs(p.imag()) + 0.2);
                }
            }
        }
        pole_plot_range_ = std::clamp(local_abs, 0.5, 12.0);
        const double plot_range = std::max(0.5, pole_plot_range_);
        ImPlot::SetupAxisLimits(ImAxis_X1, -plot_range, plot_range, ImGuiCond_Always);
        ImPlot::SetupAxisLimits(ImAxis_Y1, -plot_range, plot_range, ImGuiCond_Always);

        constexpr int N = 256;
        std::array<double, N> x{};
        std::array<double, N> y{};
        for (int i = 0; i < N; ++i) {
            const double th = 2.0 * kPi * static_cast<double>(i) / static_cast<double>(N - 1);
            x[static_cast<std::size_t>(i)] = std::cos(th);
            y[static_cast<std::size_t>(i)] = std::sin(th);
        }
        ImPlot::PlotLine("Unit Circle", x.data(), y.data(), N);

        // Plot open-loop zeros (roots of numerator polynomial).
        std::vector<double> num_desc;
        if (use_manual_open_loop_) {
            num_desc = manual_num_desc_;
        } else {
            num_desc = extracted_model_.num;
        }
        if (!num_desc.empty()) {
            bool all_zero = true;
            for (double c : num_desc) {
                if (std::abs(c) > 1e-12) {
                    all_zero = false;
                    break;
                }
            }
            if (!all_zero) {
                const auto zeros = roots_from_descending_coeffs(num_desc);
                std::vector<double> zx;
                std::vector<double> zy;
                zx.reserve(zeros.size());
                zy.reserve(zeros.size());
                for (const auto& z : zeros) {
                    zx.push_back(z.real());
                    zy.push_back(z.imag());
                }
                if (!zx.empty()) {
                    ImPlot::PlotScatter("Zeros (O)", zx.data(), zy.data(), static_cast<int>(zx.size()));
                }
            }
        }

        if (!trajectory_.poles_per_k.empty()) {
            const std::size_t pole_count = trajectory_.poles_per_k.front().size();
            for (std::size_t p = 0; p < pole_count; ++p) {
                std::vector<double> xr;
                std::vector<double> yi;
                xr.reserve(trajectory_.poles_per_k.size());
                yi.reserve(trajectory_.poles_per_k.size());

                for (const auto& poles : trajectory_.poles_per_k) {
                    if (p < poles.size()) {
                        xr.push_back(poles[p].real());
                        yi.push_back(poles[p].imag());
                    }
                }

                const std::string label = "Pole " + std::to_string(p + 1);
                ImPlot::PlotLine(label.c_str(), xr.data(), yi.data(), static_cast<int>(xr.size()));
            }

            const auto& poles_now = trajectory_.poles_per_k[best];
            std::vector<double> xr_now;
            std::vector<double> yi_now;
            xr_now.reserve(poles_now.size());
            yi_now.reserve(poles_now.size());
            for (const auto& p : poles_now) {
                xr_now.push_back(p.real());
                yi_now.push_back(p.imag());
            }
            if (!xr_now.empty()) {
                ImPlot::PlotScatter("Current poles (K)", xr_now.data(), yi_now.data(), static_cast<int>(xr_now.size()));
            }
        }

        ImPlot::EndPlot();
    }

    const int order = use_manual_open_loop_ ? std::max(manual_den_degree_, manual_num_degree_) : extracted_model_.order;
    ImGui::Text("Order n = %d", order);
    ImGui::Text("Current K = %.4f", k_gain_);
    ImGui::Text("Mode: %s", use_manual_open_loop_ ? "Manual open-loop G(z)=N(z)/D(z)" : "Extracted from diagram");
}

void BlockDesigner::render_model_extraction_window() {
    ImGui::TextWrapped(
        "Target: extract model from the current block graph. "
        "Current implementation supports the canonical loop "
        "Constant -> Sum(+,-) -> Gain -> Plant, with Plant feedback to Sum(-).");

    if (!extracted_model_.valid) {
        ImGui::TextColored(ImVec4(1.0f, 0.45f, 0.35f, 1.0f), "Extraction status: not available");
        ImGui::TextWrapped("%s", extracted_model_.message.c_str());
        return;
    }

    ImGui::TextColored(ImVec4(0.45f, 0.9f, 0.45f, 1.0f), "Extraction status: success");
    ImGui::TextWrapped("%s", extracted_model_.message.c_str());
    ImGui::Separator();

    ImGui::Text("Order n = %d", extracted_model_.order);
    ImGui::Text("Gain K = %.6f", extracted_model_.K);

    ImGui::Text("Plant denominator A(z): z^n + a1 z^(n-1) + ... + an");
    for (int i = 0; i < extracted_model_.order; ++i) {
        ImGui::BulletText("a%d = %.6f", i + 1, extracted_model_.den[static_cast<std::size_t>(i)]);
    }

    ImGui::Text("Plant numerator B(z): b0 z^(n-1) + ... + b(n-1)");
    for (int i = 0; i < extracted_model_.order; ++i) {
        ImGui::BulletText("b%d = %.6f", i, extracted_model_.num[static_cast<std::size_t>(i)]);
    }

    ImGui::Separator();
    ImGui::Text("Closed-loop denominator: A(z) + K B(z)");
    for (std::size_t i = 0; i < extracted_model_.cl_den.size(); ++i) {
        ImGui::BulletText("c%zu = %.6f", i, extracted_model_.cl_den[i]);
    }

}

void BlockDesigner::render_quickstart_window() {
    ImGui::TextWrapped("How to use:");
    ImGui::BulletText("Add blocks: Constant, Sum, Gain, Plant, Scope.");
    ImGui::BulletText("Select a block by left-clicking it. Drag to move.");
    ImGui::BulletText("Create wire: click output pin (green), then input pin (orange).");
    ImGui::BulletText("Remove a wire: right-click the target input pin.");
    ImGui::BulletText("Remove a block: select it, then click 'Remove Selected Block'.");
    ImGui::BulletText("Configure plant order and coefficients in 'Plant Parameters'.");
    ImGui::BulletText("Run simulation and tune K in 'Controller Designer'.");
    ImGui::BulletText("See y(t) in 'Time Response' and poles in 'K Sweep Visualization'.");
    ImGui::Separator();
    ImGui::TextWrapped(
        "Recommended first setup: Constant -> Sum(+) -> Gain -> Plant -> Scope, "
        "and Plant -> Sum(-) for feedback.");
}

void BlockDesigner::render_menu_sidebar() {
    ImGui::Text("Menu");
    ImGui::Separator();
    if (ImGui::Selectable("Quick Start", active_view_ == MainView::QuickStart)) {
        active_view_ = MainView::QuickStart;
    }
    if (ImGui::Selectable("Diagram", active_view_ == MainView::Diagram)) {
        active_view_ = MainView::Diagram;
    }
    if (ImGui::Selectable("Time Response", active_view_ == MainView::Response)) {
        active_view_ = MainView::Response;
    }
    if (ImGui::Selectable("K Sweep", active_view_ == MainView::PoleSweep)) {
        active_view_ = MainView::PoleSweep;
    }
    if (ImGui::Selectable("Model Extraction", active_view_ == MainView::Extraction)) {
        active_view_ = MainView::Extraction;
    }
}

} // namespace designer
