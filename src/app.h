#pragma once

#include "designer/block_designer.h"

class App {
public:
    void update(double frame_dt);
    void render();

private:
    designer::BlockDesigner designer_{};
};
