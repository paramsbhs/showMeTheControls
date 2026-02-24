#include "app.h"

void App::update(double frame_dt) {
    designer_.update(frame_dt);
}

void App::render() {
    designer_.render();
}
