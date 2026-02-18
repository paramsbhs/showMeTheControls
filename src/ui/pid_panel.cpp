#include "pid_panel.h"

#include <imgui.h>

void DrawPIDPanel(PIDPanelModel& model) {
    ImGui::Begin("PID Tuning");
    ImGui::Text("Controller Gains");

    bool changed = false;
    changed |= ImGui::SliderFloat("Kp", &model.kp, 0.0f, 10.0f, "%.3f");
    changed |= ImGui::SliderFloat("Ki", &model.ki, 0.0f, 10.0f, "%.3f");
    changed |= ImGui::SliderFloat("Kd", &model.kd, 0.0f, 10.0f, "%.3f");
    model.gains_changed = model.gains_changed || changed;

    ImGui::Separator();
    ImGui::SliderFloat("Disturbance", &model.disturbance, -5.0f, 5.0f, "%.2f");

    if (ImGui::Button("Reset simulation")) {
        model.reset_requested = true;
    }
    if (ImGui::Button("Apply disturbance")) {
        model.disturbance_requested = true;
    }

    ImGui::End();
}
