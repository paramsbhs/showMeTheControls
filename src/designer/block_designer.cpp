#include "block_designer.h"
#include "control_math.h"

#include <algorithm>
#include <cstdint>
#include <deque>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include <imgui.h>

namespace designer {

namespace {

int expected_input_pins(const Block& block) {
    if (dynamic_cast<const ConstantBlock*>(&block) != nullptr) {
        return 0;
    }
    if (dynamic_cast<const SumBlock*>(&block) != nullptr) {
        return 2;
    }
    return 1;
}

int expected_output_pins(const Block& block) {
    if (dynamic_cast<const ScopeBlock*>(&block) != nullptr) {
        return 0;
    }
    return 1;
}

bool is_direct_feedthrough(const Block& block) {
    if (dynamic_cast<const PlantBlock*>(&block) != nullptr) {
        // Plant block is modeled as strictly proper (no D term), so no same-step feedthrough.
        return false;
    }
    return true;
}

int adjust_index_after_remove(int idx, int removed) {
    if (idx < 0) {
        return idx;
    }
    if (idx == removed) {
        return -1;
    }
    return (idx > removed) ? (idx - 1) : idx;
}

} // namespace

void ConstantBlock::step(double /*dt*/) {
    if (!outputs.empty() && outputs[0]) {
        outputs[0]->value = constant;
    }
}

void SumBlock::step(double /*dt*/) {
    if (outputs.empty() || !outputs[0]) {
        return;
    }
    double acc = 0.0;
    const std::size_t n = std::min(inputs.size(), signs.size());
    for (std::size_t i = 0; i < n; ++i) {
        if (inputs[i]) {
            acc += static_cast<double>(signs[i]) * inputs[i]->value;
        }
    }
    outputs[0]->value = acc;
}

void GainBlock::step(double /*dt*/) {
    if (inputs.empty() || outputs.empty() || !inputs[0] || !outputs[0]) {
        return;
    }
    outputs[0]->value = K * inputs[0]->value;
}

void PlantBlock::set_order(int n) {
    order = std::max(1, n);
    generate_stable_plant_preset(order, den, num);
    reset();
}

void PlantBlock::reset() {
    y_hist.assign(static_cast<std::size_t>(order), 0.0);
    u_hist.assign(static_cast<std::size_t>(order), 0.0);
}

void PlantBlock::step(double /*dt*/) {
    if (inputs.empty() || outputs.empty() || !inputs[0] || !outputs[0]) {
        return;
    }

    const double u = inputs[0]->value;
    double y = 0.0;
    for (int i = 0; i < order; ++i) {
        const std::size_t idx = static_cast<std::size_t>(i);
        y += -den[idx] * y_hist[idx];
        y += num[idx] * u_hist[idx];
    }

    y_hist.push_front(y);
    if (y_hist.size() > static_cast<std::size_t>(order)) {
        y_hist.pop_back();
    }
    u_hist.push_front(u);
    if (u_hist.size() > static_cast<std::size_t>(order)) {
        u_hist.pop_back();
    }

    outputs[0]->value = y;
}

void ScopeBlock::clear() {
    tlog.clear();
    ylog.clear();
    t = 0.0;
}

void ScopeBlock::step(double dt) {
    if (inputs.empty() || !inputs[0]) {
        return;
    }
    t += dt;
    tlog.push_back(t);
    ylog.push_back(inputs[0]->value);

    if (tlog.size() > max_samples) {
        const std::size_t keep = max_samples / 2;
        tlog.erase(tlog.begin(), tlog.end() - static_cast<std::ptrdiff_t>(keep));
        ylog.erase(ylog.begin(), ylog.end() - static_cast<std::ptrdiff_t>(keep));
    }
}

Signal* Diagram::newSignal() {
    signals.emplace_back(std::make_unique<Signal>());
    return signals.back().get();
}

bool Diagram::rebuild_execution_order() {
    execution_order.clear();
    has_cycle = false;
    schedule_message.clear();

    const std::size_t n = blocks.size();
    if (n == 0) {
        schedule_message = "No blocks in graph.";
        return true;
    }

    std::vector<int> indegree(n, 0);
    std::vector<std::vector<int>> adj(n);

    for (const Connection& c : connections) {
        if (c.from_block < 0 || c.to_block < 0) {
            continue;
        }
        const std::size_t from = static_cast<std::size_t>(c.from_block);
        const std::size_t to = static_cast<std::size_t>(c.to_block);
        if (from >= n || to >= n || from == to) {
            continue;
        }
        if (!is_direct_feedthrough(*blocks[from])) {
            continue;
        }
        adj[from].push_back(static_cast<int>(to));
        indegree[to] += 1;
    }

    std::deque<int> q;
    for (std::size_t i = 0; i < n; ++i) {
        if (indegree[i] == 0) {
            q.push_back(static_cast<int>(i));
        }
    }

    while (!q.empty()) {
        const int u = q.front();
        q.pop_front();
        execution_order.push_back(u);
        for (int v : adj[static_cast<std::size_t>(u)]) {
            indegree[static_cast<std::size_t>(v)] -= 1;
            if (indegree[static_cast<std::size_t>(v)] == 0) {
                q.push_back(v);
            }
        }
    }

    if (execution_order.size() != n) {
        has_cycle = true;
        schedule_message = "Scheduling error: algebraic loop/cycle detected in block connections.";
        execution_order.clear();
        for (std::size_t i = 0; i < n; ++i) {
            execution_order.push_back(static_cast<int>(i));
        }
        return false;
    }

    schedule_message = "Scheduling OK: topological order computed from current wiring.";
    return true;
}

void Diagram::step(double dt) {
    if (has_cycle) {
        return;
    }
    for (int idx : execution_order) {
        blocks[static_cast<std::size_t>(idx)]->step(dt);
    }
}

BlockDesigner::BlockDesigner() {
    build_default_diagram();
    recompute_model_extraction();
    recompute_sweep();
}

void BlockDesigner::refresh_core_block_handles() {
    controller_gain_ = nullptr;
    output_scope_ = nullptr;
    plant_ = nullptr;

    for (const auto& b : diagram_.blocks) {
        if (!controller_gain_) {
            controller_gain_ = dynamic_cast<GainBlock*>(b.get());
        }
        if (!output_scope_) {
            output_scope_ = dynamic_cast<ScopeBlock*>(b.get());
        }
        if (!plant_) {
            plant_ = dynamic_cast<PlantBlock*>(b.get());
        }
    }
}

void BlockDesigner::add_block(NewBlockType type) {
    Block* raw = nullptr;
    const int idx = static_cast<int>(diagram_.blocks.size());
    switch (type) {
    case NewBlockType::Constant: {
        auto* b = diagram_.addBlock<ConstantBlock>("Constant");
        b->constant = 1.0;
        raw = b;
        break;
    }
    case NewBlockType::Sum: {
        auto* b = diagram_.addBlock<SumBlock>("Sum");
        b->signs = {+1, -1};
        raw = b;
        break;
    }
    case NewBlockType::Gain: {
        auto* b = diagram_.addBlock<GainBlock>("Gain");
        b->K = 1.0;
        raw = b;
        break;
    }
    case NewBlockType::FirstOrderPlant: {
        auto* b = diagram_.addBlock<PlantBlock>("Plant");
        b->set_order(1);
        raw = b;
        break;
    }
    case NewBlockType::Scope: {
        auto* b = diagram_.addBlock<ScopeBlock>("Scope");
        raw = b;
        break;
    }
    }
    if (!raw) {
        return;
    }

    raw->inputs.resize(static_cast<std::size_t>(expected_input_pins(*raw)), nullptr);
    raw->outputs.resize(static_cast<std::size_t>(expected_output_pins(*raw)), nullptr);

    const int row = idx / 5;
    const int col = idx % 5;
    node_views_.push_back({80.0f + static_cast<float>(col) * 220.0f, 380.0f + static_cast<float>(row) * 160.0f});
    selected_block_ = idx;

    refresh_core_block_handles();
    rebuild_signals_from_connections();
}

void BlockDesigner::remove_block(int block_index) {
    if (block_index < 0 || static_cast<std::size_t>(block_index) >= diagram_.blocks.size()) {
        return;
    }

    diagram_.blocks.erase(diagram_.blocks.begin() + static_cast<std::ptrdiff_t>(block_index));
    if (static_cast<std::size_t>(block_index) < node_views_.size()) {
        node_views_.erase(node_views_.begin() + static_cast<std::ptrdiff_t>(block_index));
    }

    diagram_.connections.erase(
        std::remove_if(
            diagram_.connections.begin(),
            diagram_.connections.end(),
            [&](const Connection& c) {
                return c.from_block == block_index || c.to_block == block_index;
            }),
        diagram_.connections.end());

    for (Connection& c : diagram_.connections) {
        if (c.from_block > block_index) {
            c.from_block -= 1;
        }
        if (c.to_block > block_index) {
            c.to_block -= 1;
        }
    }

    selected_block_ = adjust_index_after_remove(selected_block_, block_index);
    dragging_block_ = adjust_index_after_remove(dragging_block_, block_index);
    pending_link_from_block_ = adjust_index_after_remove(pending_link_from_block_, block_index);

    refresh_core_block_handles();
    rebuild_signals_from_connections();
}

void BlockDesigner::rebuild_signals_from_connections() {
    diagram_.signals.clear();

    for (auto& b : diagram_.blocks) {
        b->inputs.assign(static_cast<std::size_t>(expected_input_pins(*b)), nullptr);
        b->outputs.assign(static_cast<std::size_t>(expected_output_pins(*b)), nullptr);
    }

    std::unordered_map<std::uint64_t, Signal*> output_signal_map;
    output_signal_map.reserve(diagram_.connections.size());

    for (const Connection& c : diagram_.connections) {
        if (c.from_block < 0 || c.to_block < 0) {
            continue;
        }
        const std::size_t from = static_cast<std::size_t>(c.from_block);
        const std::size_t to = static_cast<std::size_t>(c.to_block);
        if (from >= diagram_.blocks.size() || to >= diagram_.blocks.size()) {
            continue;
        }

        Block& from_block = *diagram_.blocks[from];
        Block& to_block = *diagram_.blocks[to];
        if (c.from_pin < 0 || c.to_pin < 0) {
            continue;
        }
        if (static_cast<std::size_t>(c.from_pin) >= from_block.outputs.size()) {
            continue;
        }
        if (static_cast<std::size_t>(c.to_pin) >= to_block.inputs.size()) {
            continue;
        }

        const std::uint64_t key = (static_cast<std::uint64_t>(static_cast<std::uint32_t>(c.from_block)) << 32U)
            | static_cast<std::uint32_t>(c.from_pin);
        Signal* s = nullptr;
        auto it = output_signal_map.find(key);
        if (it == output_signal_map.end()) {
            s = diagram_.newSignal();
            output_signal_map.emplace(key, s);
            from_block.outputs[static_cast<std::size_t>(c.from_pin)] = s;
        } else {
            s = it->second;
        }
        to_block.inputs[static_cast<std::size_t>(c.to_pin)] = s;
    }

    diagram_.rebuild_execution_order();
    recompute_model_extraction();
    recompute_sweep();
}

void BlockDesigner::recompute_model_extraction() {
    extracted_model_ = {};

    if (!controller_gain_ || !plant_) {
        extracted_model_.message = "Model extraction unavailable: missing controller gain or plant block.";
        return;
    }

    int gain_idx = -1;
    int plant_idx = -1;
    int sum_idx = -1;
    int ref_idx = -1;
    for (std::size_t i = 0; i < diagram_.blocks.size(); ++i) {
        Block* b = diagram_.blocks[i].get();
        if (b == controller_gain_) {
            gain_idx = static_cast<int>(i);
        }
        if (b == plant_) {
            plant_idx = static_cast<int>(i);
        }
        if (dynamic_cast<SumBlock*>(b) != nullptr && sum_idx < 0) {
            sum_idx = static_cast<int>(i);
        }
        if (dynamic_cast<ConstantBlock*>(b) != nullptr && ref_idx < 0) {
            ref_idx = static_cast<int>(i);
        }
    }

    if (gain_idx < 0 || plant_idx < 0 || sum_idx < 0 || ref_idx < 0) {
        extracted_model_.message =
            "Model extraction currently supports the canonical loop: Constant -> Sum -> Gain -> Plant with feedback.";
        return;
    }

    const auto find_connection = [&](int from_block, int from_pin, int to_block, int to_pin) {
        return std::find_if(
            diagram_.connections.begin(),
            diagram_.connections.end(),
            [&](const Connection& c) {
                return c.from_block == from_block && c.from_pin == from_pin && c.to_block == to_block && c.to_pin == to_pin;
            });
    };

    auto it_sum_to_gain = find_connection(sum_idx, 0, gain_idx, 0);
    auto it_gain_to_plant = find_connection(gain_idx, 0, plant_idx, 0);
    auto it_ref_to_sum = find_connection(ref_idx, 0, sum_idx, 0);
    auto it_plant_to_sum = find_connection(plant_idx, 0, sum_idx, 1);

    if (it_sum_to_gain == diagram_.connections.end()
        || it_gain_to_plant == diagram_.connections.end()
        || it_ref_to_sum == diagram_.connections.end()
        || it_plant_to_sum == diagram_.connections.end()) {
        extracted_model_.message =
            "Extraction requires this wiring: ref->sum(+) , plant->sum(-), sum->gain, gain->plant.";
        return;
    }

    SumBlock* sum_block = dynamic_cast<SumBlock*>(diagram_.blocks[static_cast<std::size_t>(sum_idx)].get());
    GainBlock* gain_block = dynamic_cast<GainBlock*>(controller_gain_);
    PlantBlock* plant_block = dynamic_cast<PlantBlock*>(plant_);
    if (!sum_block || !gain_block || !plant_block) {
        extracted_model_.message = "Extraction failed: block type mismatch in canonical loop.";
        return;
    }

    if (sum_block->signs.size() < 2 || sum_block->signs[0] != +1 || sum_block->signs[1] != -1) {
        extracted_model_.message = "Extraction expects negative unity feedback at Sum: signs should be {+1, -1}.";
        return;
    }

    extracted_model_.valid = true;
    extracted_model_.message = "Extracted from canonical negative-feedback graph.";
    extracted_model_.K = gain_block->K;
    extracted_model_.order = plant_block->order;
    extracted_model_.den = plant_block->den;
    extracted_model_.num = plant_block->num;

    // Closed-loop denominator (descending z powers): A(z) + K B(z),
    // where A = z^n + a1 z^(n-1) + ... + an and B = b0 z^(n-1) + ... + b(n-1).
    extracted_model_.cl_den.assign(static_cast<std::size_t>(plant_block->order + 1), 0.0);
    extracted_model_.cl_den[0] = 1.0;
    for (int i = 0; i < plant_block->order; ++i) {
        extracted_model_.cl_den[static_cast<std::size_t>(i + 1)] =
            plant_block->den[static_cast<std::size_t>(i)] + gain_block->K * plant_block->num[static_cast<std::size_t>(i)];
    }
}

void BlockDesigner::build_default_diagram() {
    auto* ref = diagram_.addBlock<ConstantBlock>("Reference");
    auto* sum = diagram_.addBlock<SumBlock>("Sum");
    auto* gain = diagram_.addBlock<GainBlock>("ControllerGain");
    auto* plant = diagram_.addBlock<PlantBlock>("Plant");
    auto* scope = diagram_.addBlock<ScopeBlock>("OutputScope");

    controller_gain_ = gain;
    output_scope_ = scope;
    plant_ = plant;

    sum->signs = {+1, -1};

    ref->outputs.resize(1, nullptr);
    sum->inputs.resize(2, nullptr);
    sum->outputs.resize(1, nullptr);
    gain->inputs.resize(1, nullptr);
    gain->outputs.resize(1, nullptr);
    plant->set_order(1);
    plant->inputs.resize(1, nullptr);
    plant->outputs.resize(1, nullptr);
    scope->inputs.resize(1, nullptr);

    diagram_.connections = {
        {0, 0, 1, 0},
        {3, 0, 1, 1},
        {1, 0, 2, 0},
        {2, 0, 3, 0},
        {3, 0, 4, 0}
    };

    gain->K = k_gain_;
    ref->constant = 1.0;

    node_views_ = {
        {60.0f, 120.0f},
        {280.0f, 120.0f},
        {500.0f, 120.0f},
        {720.0f, 120.0f},
        {940.0f, 120.0f}
    };

    refresh_core_block_handles();
    rebuild_signals_from_connections();
}

void BlockDesigner::recompute_sweep() {
    trajectory_ = {};
    if (!use_manual_open_loop_ && !extracted_model_.valid) {
        return;
    }

    const int n_samples = std::max(2, k_sweep_samples_);
    trajectory_.k_values.reserve(static_cast<std::size_t>(n_samples));
    trajectory_.poles_per_k.reserve(static_cast<std::size_t>(n_samples));

    for (int i = 0; i < n_samples; ++i) {
        const double alpha = static_cast<double>(i) / static_cast<double>(n_samples - 1);
        const double K = alpha * k_sweep_max_;
        trajectory_.k_values.push_back(K);
        const std::vector<double> cl_den = make_characteristic_for_k(K);
        trajectory_.poles_per_k.push_back(roots_from_descending_coeffs(cl_den));
    }
}

void BlockDesigner::resize_poly_desc(std::vector<double>& coeffs, int degree) {
    const int d = std::max(0, degree);
    const std::size_t target = static_cast<std::size_t>(d + 1);
    if (coeffs.size() < target) {
        coeffs.insert(coeffs.begin(), target - coeffs.size(), 0.0);
    } else if (coeffs.size() > target) {
        coeffs.erase(coeffs.begin(), coeffs.begin() + static_cast<std::ptrdiff_t>(coeffs.size() - target));
    }
}

std::vector<double> BlockDesigner::make_characteristic_for_k(double K) const {
    if (use_manual_open_loop_) {
        const int d = std::max(manual_den_degree_, manual_num_degree_);
        std::vector<double> D(static_cast<std::size_t>(d + 1), 0.0);
        std::vector<double> N(static_cast<std::size_t>(d + 1), 0.0);

        const int den_offset = d - manual_den_degree_;
        for (int i = 0; i <= manual_den_degree_ && i < static_cast<int>(manual_den_desc_.size()); ++i) {
            D[static_cast<std::size_t>(i + den_offset)] = manual_den_desc_[static_cast<std::size_t>(i)];
        }
        const int num_offset = d - manual_num_degree_;
        for (int i = 0; i <= manual_num_degree_ && i < static_cast<int>(manual_num_desc_.size()); ++i) {
            N[static_cast<std::size_t>(i + num_offset)] = manual_num_desc_[static_cast<std::size_t>(i)];
        }

        std::vector<double> out(static_cast<std::size_t>(d + 1), 0.0);
        for (int i = 0; i <= d; ++i) {
            out[static_cast<std::size_t>(i)] = D[static_cast<std::size_t>(i)] + K * N[static_cast<std::size_t>(i)];
        }
        return out;
    }

    std::vector<double> cl_den(static_cast<std::size_t>(extracted_model_.order + 1), 0.0);
    cl_den[0] = 1.0;
    for (int j = 0; j < extracted_model_.order; ++j) {
        cl_den[static_cast<std::size_t>(j + 1)] =
            extracted_model_.den[static_cast<std::size_t>(j)] + K * extracted_model_.num[static_cast<std::size_t>(j)];
    }
    return cl_den;
}

void BlockDesigner::reset_simulation() {
    if (output_scope_) {
        output_scope_->clear();
    }
    if (plant_) {
        plant_->reset();
    }
}

void BlockDesigner::update(double /*frame_dt*/) {
    if (controller_gain_) {
        controller_gain_->K = k_gain_;
    }

    recompute_model_extraction();
    recompute_sweep();

    if (run_sim_) {
        for (int i = 0; i < 5; ++i) {
            diagram_.step(dt_);
        }
    }
}

void BlockDesigner::reset_graph_views() {
    response_window_seconds_ = 10.0;
    pole_plot_range_ = 2.0;
}

void BlockDesigner::render() {
    ImGuiViewport* vp = ImGui::GetMainViewport();
    ImGui::SetNextWindowPos(vp->WorkPos, ImGuiCond_Always);
    ImGui::SetNextWindowSize(vp->WorkSize, ImGuiCond_Always);
    ImGui::Begin(
        "Control Theory Lab",
        nullptr,
        ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoResize | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_MenuBar);

    if (ImGui::BeginMenuBar()) {
        ImGui::TextUnformatted("Control Theory Lab");
        ImGui::EndMenuBar();
    }

    const float sidebar_w = 220.0f;
    ImGui::BeginChild("Sidebar", ImVec2(sidebar_w, 0.0f), true);
    render_menu_sidebar();
    ImGui::EndChild();

    ImGui::SameLine();
    ImGui::BeginChild("MainContent", ImVec2(0.0f, 0.0f), false);
    render_toolbar();
    ImGui::Separator();

    switch (active_view_) {
    case MainView::QuickStart:
        render_quickstart_window();
        break;
    case MainView::Diagram:
        render_block_editor_window();
        break;
    case MainView::Response:
        render_time_plot_window();
        break;
    case MainView::PoleSweep:
        render_gain_sweep_window();
        break;
    case MainView::Extraction:
        render_model_extraction_window();
        break;
    }

    ImGui::EndChild();
    ImGui::End();
}

} // namespace designer
