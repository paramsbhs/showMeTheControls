cmake_minimum_required(VERSION 3.20)
project(control_lab LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(OpenGL REQUIRED)

set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
set(GLFW_BUILD_WAYLAND OFF CACHE BOOL "" FORCE)
add_subdirectory(external/glfw)

set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/external/imgui)
set(IMPLOT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/external/implot)
set(EIGEN_DIR ${CMAKE_CURRENT_SOURCE_DIR}/external/eigen)

add_library(imgui STATIC
    ${IMGUI_DIR}/imgui.cpp
    ${IMGUI_DIR}/imgui_draw.cpp
    ${IMGUI_DIR}/imgui_tables.cpp
    ${IMGUI_DIR}/imgui_widgets.cpp
    ${IMGUI_DIR}/backends/imgui_impl_glfw.cpp
    ${IMGUI_DIR}/backends/imgui_impl_opengl3.cpp
    ${IMPLOT_DIR}/implot.cpp
    ${IMPLOT_DIR}/implot_items.cpp
)
target_include_directories(imgui PUBLIC
    ${IMGUI_DIR}
    ${IMGUI_DIR}/backends
    ${IMPLOT_DIR}
    ${EIGEN_DIR}
)
target_link_libraries(imgui PUBLIC glfw OpenGL::GL)

add_executable(controllab
    src/main.cpp
    src/app.cpp
    src/control/pid.cpp
    src/control/state_space.cpp
    src/control/transfer_function.cpp
    src/systems/second_order.cpp
    src/ui/pid_panel.cpp
    src/ui/state_space_panel.cpp
    src/viz/zplane.cpp
)
target_include_directories(controllab PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${EIGEN_DIR}
)
target_link_libraries(controllab PRIVATE imgui glfw OpenGL::GL)

if(UNIX AND NOT APPLE)
    target_link_libraries(controllab PRIVATE m)
endif()
