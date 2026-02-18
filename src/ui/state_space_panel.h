#pragma once

#include "control/state_space.h"

struct StateSpacePanelData {
    StateSpace system;
};

void DrawStateSpacePanel(const StateSpacePanelData& data);
