#include "state_space_panel.h"

#include <string>

#include <imgui.h>

namespace {

void DrawMatrixTable(const char* title, const Eigen::MatrixXd& M) {
    ImGui::Text("%s (%d x %d)", title, static_cast<int>(M.rows()), static_cast<int>(M.cols()));
    std::string table_id = std::string("##") + title;
    if (ImGui::BeginTable(table_id.c_str(), M.cols(), ImGuiTableFlags_Borders | ImGuiTableFlags_SizingFixedFit)) {
        for (int r = 0; r < M.rows(); ++r) {
            ImGui::TableNextRow();
            for (int c = 0; c < M.cols(); ++c) {
                ImGui::TableSetColumnIndex(c);
                ImGui::Text("%.4f", M(r, c));
            }
        }
        ImGui::EndTable();
    }
}

} // namespace

void DrawStateSpacePanel(const StateSpacePanelData& data) {
    const StateSpace& ss = data.system;
    if (ss.A.size() == 0 || ss.B.size() == 0 || ss.C.size() == 0 || ss.D.size() == 0) {
        return;
    }

    const Eigen::MatrixXd ctrb = ControllabilityMatrix(ss);
    const Eigen::MatrixXd obsv = ObservabilityMatrix(ss);
    const int n = static_cast<int>(ss.A.rows());
    const int rank_ctrb = MatrixRank(ctrb);
    const int rank_obsv = MatrixRank(obsv);
    const bool controllable = (rank_ctrb == n);
    const bool observable = (rank_obsv == n);

    ImGui::Begin("State-Space Analysis");
    ImGui::Text("Discrete-time system x[k+1] = Ax[k] + Bu[k], y[k] = Cx[k] + Du[k]");

    DrawMatrixTable("A", ss.A);
    DrawMatrixTable("B", ss.B);
    DrawMatrixTable("C", ss.C);
    DrawMatrixTable("D", ss.D);

    ImGui::Separator();
    DrawMatrixTable("Controllability Matrix", ctrb);
    ImGui::Text("rank(C) = %d / %d", rank_ctrb, n);
    ImGui::TextColored(
        controllable ? ImVec4(0.3f, 0.9f, 0.4f, 1.0f) : ImVec4(1.0f, 0.4f, 0.4f, 1.0f),
        controllable ? "System is controllable" : "System is not controllable");

    ImGui::Separator();
    DrawMatrixTable("Observability Matrix", obsv);
    ImGui::Text("rank(O) = %d / %d", rank_obsv, n);
    ImGui::TextColored(
        observable ? ImVec4(0.3f, 0.9f, 0.4f, 1.0f) : ImVec4(1.0f, 0.4f, 0.4f, 1.0f),
        observable ? "System is observable" : "System is not observable");

    ImGui::End();
}
