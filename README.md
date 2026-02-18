# showMeTheControls

Interactive digital control systems visualizer for learning:

## Features to be implemented
- Z-plane pole/zero placement
- State-space analysis (controllability/observability)
- Pole placement via Ackermann
- State observer visualization
- PID tuning with live plots

## Quick Start
```bash
git submodule update --init --recursive
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -j$(nproc)
./controllab
