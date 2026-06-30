# CMakeLists.txt — host build for the micdrp DSP core parity test.
#
# This builds ONLY the dependency-free, STL-only DSP core and its host parity
# test. It is NOT the RN native build (iOS/Android consume these .cpp files via
# their own Xcode/Gradle/CMake setups — see README.md). Its sole purpose is to
# let a developer (or CI on a real box) verify C++/TS parity:
#
#   cd packages/client/cpp/dsp
#   cmake -S . -B build && cmake --build build
#   ./build/dsp_parity_test      # prints "PARITY OK", exit 0
#
# Or, quick one-liner without CMake:
#   c++ -std=c++17 -O2 -I. mpm.cpp notes.cpp ring_buffer.cpp pitch_engine.cpp \
#       __tests__/parity_test.cpp -o dsp_parity_test && ./dsp_parity_test

cmake_minimum_required(VERSION 3.16)
project(micdrp_dsp_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# The portable DSP core: no RN, no JNI, no Objective-C — STL only.
add_library(micdrp_dsp STATIC
  mpm.cpp
  notes.cpp
  ring_buffer.cpp
  pitch_engine.cpp
)
target_include_directories(micdrp_dsp PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

if(MSVC)
  target_compile_options(micdrp_dsp PRIVATE /W4)
else()
  target_compile_options(micdrp_dsp PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Host parity test executable.
add_executable(dsp_parity_test __tests__/parity_test.cpp)
target_link_libraries(dsp_parity_test PRIVATE micdrp_dsp)

enable_testing()
add_test(NAME dsp_parity COMMAND dsp_parity_test)
