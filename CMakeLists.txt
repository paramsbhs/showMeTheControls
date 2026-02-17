cmake_minimum_required(VERSION 3.20)
project(ControlLab LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# GLFW: Disable Wayland issues
set(GLFW_BUILD_WAYLAND OFF CACHE BOOL "" FORCE)
add_subdirectory(external/glfw)

# ImGui + ImPlot
set(IMGUI_DIR external/imgui)
file(GLOB IMGUI_SOURCES
    ${IMGUI_DIR}/*.cpp
    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
    ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
)

add_library(imgui STATIC ${IMGUI_SOURCES})
target_include_directories(imgui PUBLIC
    ${IMGUI_DIR}
    ${IMGUI_DIR}/backends
    external/implot
)
target_link_libraries(imgui PUBLIC glfw)

# Eigen
find_package(Eigen3 REQUIRED)

# OpenGL
find_package(OpenGL REQUIRED)

# Main executable
add_executable(controllab src/main.cpp)
target_link_libraries(controllab
    imgui
    glfw
    Eigen3::Eigen
    OpenGL::GL
)
