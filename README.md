# showMeTheControls

Interactive Simulink-style controller design sandbox.

## Current Features
- Block canvas with drag/drop node layout
- Block palette (Constant, Sum, Gain, Plant, Scope)
- Wire creation (output pin -> input pin) and wire removal
- Safe scheduling with direct-feedthrough-aware cycle checks
- Time response plot from scope output
- Graph-based model extraction for canonical negative-feedback loop
- Real K-sweep closed-loop pole trajectory from extracted model

## Quick Start
```bash
git submodule update --init --recursive
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -j$(nproc)
./controllab
```

## Screenshots
![Control Theory Tutor UI](external/Screenshot%20from%202026-02-24%2010-54-33.png)

![Root Locus View](external/Screenshot%20from%202026-02-24%2010-55-27.png)
