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
    src/designer/block_designer.cpp
    src/designer/block_designer_ui.cpp
    src/designer/control_math.cpp
)
target_include_directories(controllab PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${EIGEN_DIR}
)
target_link_libraries(controllab PRIVATE imgui glfw OpenGL::GL)

if(UNIX AND NOT APPLE)
    target_link_libraries(controllab PRIVATE m)
endif()

add_executable(designer_tests
    tests/designer_tests.cpp
    src/designer/block_designer.cpp
    src/designer/block_designer_ui.cpp
    src/designer/control_math.cpp
)
target_include_directories(designer_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${EIGEN_DIR}
)
target_link_libraries(designer_tests PRIVATE imgui glfw OpenGL::GL)

enable_testing()
add_test(NAME designer_tests COMMAND designer_tests)
