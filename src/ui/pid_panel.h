#pragma once

struct PIDPanelModel {
    float kp = 2.0f;
    float ki = 0.5f;
    float kd = 0.05f;
    float disturbance = 1.0f;
    bool gains_changed = false;
    bool reset_requested = false;
    bool disturbance_requested = false;
};

void DrawPIDPanel(PIDPanelModel& model);
