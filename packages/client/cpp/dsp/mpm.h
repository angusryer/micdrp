// mpm.h — McLeod Pitch Method (MPM) monophonic pitch detection.
//
// Portable C++17 port of packages/logic/src/mpm.ts: NSDF (type-II
// autocorrelation), per-hump peak pick, parabolic interpolation, clarity
// threshold, and min/max frequency bounds. The TS version is the golden
// reference; cpp/dsp/__tests__/parity_test.cpp asserts parity within
// 1e-4 Hz / 1 cent on shared fixtures.
//
// STL-only, no RN/JS/platform dependencies. Designed to run on the real-time
// audio thread: configure() once off the audio thread, then call detect() per
// analysis window with no heap allocation after the first sizing.

#ifndef MICDRP_DSP_MPM_H
#define MICDRP_DSP_MPM_H

#include <cstddef>
#include <vector>

namespace micdrp::dsp {

// Mirrors src/audio/contract.ts EngineConfig. Defaults match
// DEFAULT_ENGINE_CONFIG. Only the fields MPM needs are consumed here; the rest
// (hopSize, emitRateHz) are carried for callers (PitchEngine) and ignored by
// the detector itself.
struct EngineConfig {
  double sampleRateHz = 44100.0;
  std::size_t frameSize = 2048;
  std::size_t hopSize = 1024;
  double minFrequencyHz = 70.0;
  double maxFrequencyHz = 1200.0;
  double clarityThreshold = 0.9;
  double emitRateHz = 60.0;
};

// One detection. Mirrors logic/mpm.ts PitchResult, with frequency expressed as
// a sentinel (frequencyHz == 0, voiced == false) when no confident pitch was
// found, to match the PitchSample wire contract (frequencyHz 0 when unvoiced).
struct PitchResult {
  double frequencyHz = 0.0;  // 0 when unvoiced
  double clarity = 0.0;      // NSDF clarity at the chosen peak, [0, 1]
  bool voiced = false;       // true iff a confident pitch was accepted
};

class Mpm {
 public:
  Mpm() = default;

  // Apply config. Pre-sizes the NSDF scratch buffer to frameSize so that
  // detect() does not allocate on the audio thread. Safe to call repeatedly
  // off the audio thread.
  void configure(const EngineConfig& config);

  const EngineConfig& config() const { return config_; }

  // Detect the fundamental in [frame, frame + n). `n` is typically
  // config().frameSize; any n >= 4 is accepted. Mirrors logic/mpm.ts
  // detectPitch(samples, sampleRate, {clarityThreshold, minFrequency,
  // maxFrequency}). Does not allocate when n <= the configured frameSize.
  PitchResult detect(const float* frame, std::size_t n);

 private:
  EngineConfig config_{};
  // float32 to mirror logic/mpm.ts Float32Array nsdf exactly (acf/div are
  // accumulated in double, matching JS number, then narrowed on store).
  std::vector<float> nsdf_{};
  std::vector<std::size_t> maxPositions_{};  // per-hump local-max lags
};

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_MPM_H
