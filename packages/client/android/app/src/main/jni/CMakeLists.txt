cmake_minimum_required(VERSION 3.13)

# Define the library name here.
project(micdrp_appmodules)

# This file includes all the necessary to let you build your application with the New Architecture.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# micdrp native audio bridge (WP-AUDIO-BRIDGE): build libmicdrp_audio.so from the
# JNI glue (audio_jni.cpp) + the shared C++ DSP core (packages/client/cpp/dsp).
# See android/app/src/main/cpp/CMakeLists.txt and docs/NATIVE_SETUP.md.
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../cpp micdrp_audio)
