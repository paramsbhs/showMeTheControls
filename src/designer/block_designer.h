#pragma once

#include <complex>
#include <deque>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace designer {

struct Signal {
    double value = 0.0;
};

class Block {
public:
    virtual ~Block() = default;
    std::string name;
    std::vector<Signal*> inputs;
    std::vector<Signal*> outputs;
    virtual void step(double dt) = 0;
};

class ConstantBlock : public Block {
public:
    double constant = 1.0;
    void step(double dt) override;
};

class SumBlock : public Block {
public:
    std::vector<int> signs;
    void step(double dt) override;
};

class GainBlock : public Block {
public:
    double K = 1.0;
    void step(double dt) override;
};

class PlantBlock : public Block {
public:
    int order = 1;
    std::vector<double> den; // a1..an in z^n + a1 z^(n-1) + ... + an
    std::vector<double> num; // b0..b(n-1) in b0 z^(n-1) + ... + b(n-1)
    std::deque<double> y_hist;
    std::deque<double> u_hist;

    void reset();
    void step(double dt) override;
    void set_order(int n);
};

class ScopeBlock : public Block {
public:
    std::vector<double> tlog;
    std::vector<double> ylog;
    double t = 0.0;
    std::size_t max_samples = 20000;

    void clear();
    void step(double dt) override;
};

struct Connection {
    int from_block = -1;
    int from_pin = 0;
    int to_block = -1;
    int to_pin = 0;
};

class Diagram {
public:
    std::vector<std::unique_ptr<Block>> blocks;
    std::vector<Connection> connections;
    std::vector<std::unique_ptr<Signal>> signals;
    std::vector<int> execution_order;
    bool has_cycle = false;
    std::string schedule_message;

    Signal* newSignal();
    bool rebuild_execution_order();

    template <typename T, typename... Args>
    T* addBlock(const std::string& name, Args&&... args) {
        auto b = std::make_unique<T>(std::forward<Args>(args)...);
        b->name = name;
        T* ptr = b.get();
        blocks.push_back(std::move(b));
        return ptr;
    }

    void step(double dt);
};

struct PoleTrajectory {
    std::vector<double> k_values;
    std::vector<std::vector<std::complex<double>>> poles_per_k;
};

class BlockDesigner {
public:
    BlockDesigner();

    void update(double frame_dt);
    void render();

private:
    enum class MainView {
        QuickStart,
        Diagram,
        Response,
        PoleSweep,
        Extraction
    };

    enum class NewBlockType {
        Constant,
        Sum,
        Gain,
        FirstOrderPlant,
        Scope
    };

    struct NodeView {
        float x = 0.0f;
        float y = 0.0f;
    };

    void add_block(NewBlockType type);
    void remove_block(int block_index);
    void refresh_core_block_handles();
    void rebuild_signals_from_connections();
    void recompute_model_extraction();
    void build_default_diagram();
    void recompute_sweep();
    void reset_simulation();

    void render_toolbar();
    void render_block_editor_window();
    void render_time_plot_window();
    void render_gain_sweep_window();
    void render_model_extraction_window();
    void render_quickstart_window();
    void render_menu_sidebar();
    void resize_poly_desc(std::vector<double>& coeffs, int degree);
    std::vector<double> make_characteristic_for_k(double K) const;
    void reset_graph_views();

    struct ExtractedModel {
        bool valid = false;
        std::string message;
        double K = 0.0;
        int order = 0;
        std::vector<double> den;
        std::vector<double> num;
        std::vector<double> cl_den;
    };

    Diagram diagram_;

    bool run_sim_ = true;
    double dt_ = 0.001;
    double k_gain_ = 1.0;
    double k_sweep_max_ = 100.0;
    int k_sweep_samples_ = 200;

    GainBlock* controller_gain_ = nullptr;
    ScopeBlock* output_scope_ = nullptr;
    PlantBlock* plant_ = nullptr;

    PoleTrajectory trajectory_;
    ExtractedModel extracted_model_;
    std::vector<NodeView> node_views_;
    int dragging_block_ = -1;
    float drag_offset_x_ = 0.0f;
    float drag_offset_y_ = 0.0f;
    int pending_link_from_block_ = -1;
    int pending_link_from_pin_ = -1;
    int selected_block_ = -1;
    MainView active_view_ = MainView::QuickStart;
    double response_window_seconds_ = 10.0;
    double pole_plot_range_ = 2.0;
    bool use_manual_open_loop_ = false;
    int manual_den_degree_ = 2;
    int manual_num_degree_ = 1;
    std::vector<double> manual_den_desc_ = {1.0, -1.8, 0.72}; // D(z)
    std::vector<double> manual_num_desc_ = {1.0, 0.0};        // N(z)
};

} // namespace designer
