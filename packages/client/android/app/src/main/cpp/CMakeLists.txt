# WP-AUDIO-BRIDGE — native audio bridge library (Android).
#
# Builds libmicdrp_audio.so from the JNI glue (audio_jni.cpp) plus the shared
# C++ DSP core sources owned by WP-DSP-CORE in packages/client/cpp/dsp. The DSP
# sources are the single source of truth (host-parity-tested against the TS
# logic package); this library only adds the streaming/JNI shell.
#
# Wire-up: the app's Gradle externalNativeBuild already points at
# src/main/jni/CMakeLists.txt (the RN New-Architecture appmodules build). Add
#     add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../cpp micdrp_audio)
# from that file (or set this as an additional cmake path) so this target is
# compiled alongside the app modules. See docs/NATIVE_SETUP.md.

cmake_minimum_required(VERSION 3.13)
project(micdrp_audio LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Path to the shared C++ DSP core (WP-DSP-CORE):
#   android/app/src/main/cpp -> ../../../../../cpp/dsp == packages/client/cpp/dsp
get_filename_component(DSP_DIR
  "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../cpp/dsp" ABSOLUTE)

# All DSP translation units (mpm.cpp, notes.cpp, ring_buffer.cpp, pitch_engine.cpp...).
file(GLOB DSP_SOURCES "${DSP_DIR}/*.cpp")

add_library(micdrp_audio SHARED
  audio_jni.cpp
  ${DSP_SOURCES}
)

target_include_directories(micdrp_audio PRIVATE
  ${DSP_DIR}
)

# Optimize the real-time DSP path in release builds.
target_compile_options(micdrp_audio PRIVATE
  $<$<CONFIG:Release>:-O3>
  -fexceptions
)

find_library(log-lib log)
target_link_libraries(micdrp_audio ${log-lib})
