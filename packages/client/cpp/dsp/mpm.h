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

#include "fft.h"

namespace micdrp::dsp {

// Mirrors src/audio/contract.ts EngineConfig. Defaults match
// DEFAULT_ENGINE_CONFIG. Only the fields MPM needs are consumed here; the rest
// (hopSize, emitRateHz) are carried for callers (PitchEngine) and ignored by
// the detector itself.
struct EngineConfig {
  double sampleRateHz = 44100.0;
  std::size_t frameSize = 2048;
  std::size_t hopSize = 512;
  double minFrequencyHz = 70.0;
  // Mirrors DEFAULT_ENGINE_CONFIG in audio/contract.ts, which is the one
  // that decides: the resolved settings are pushed down at launch
  // (INV-ACCOUNT-015). This is what runs until they arrive.
  double maxFrequencyHz = 2500.0;
  // MPM's peak-picking parameter: which NSDF peak counts as the fundamental,
  // as a fraction of the tallest one. It decides WHICH pitch, never WHETHER
  // there is one — lowering it makes octave errors more likely, not quiet
  // notes more findable (INV-PITCH-021).
  double clarityThreshold = 0.9;
  // Whether there is a pitch at all: the absolute height the chosen peak must
  // reach, and the level the window must exceed. Two questions, two numbers.
  // This one was previously answered with clarityThreshold, which meant one
  // slider moved both and the two want opposite settings.
  double voicedClarityMin = 0.5;
  double voicedLevelDb = -55.0;
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

/**
 * What the spectrum says about a window, beyond its pitch.
 *
 * Free: the pitch detector transforms the frame anyway to get its
 * autocorrelation, and these fall out of the magnitude it passes through on
 * the way (INV-PITCH-026).
 */
struct Spectral {
  /// Energy-weighted mean frequency. Where the sound sits.
  double centroidHz = 0.0;
  /// 0..1. Near 1 is noise, near 0 is a tone. Says WHETHER it is pitched,
  /// which periodicity answers only indirectly.
  double flatness = 0.0;
  /// The frequency below which 85% of the energy lies. Separates a bright
  /// sound with a low fundamental from a genuinely high one.
  double rolloffHz = 0.0;
  /// How much the spectrum changed since the previous frame, in dB. The
  /// standard onset signal: an attack rearranges the spectrum, a sustain
  /// does not.
  double fluxDb = 0.0;
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

  /// What the last detect() found in the spectrum it had to compute anyway.
  const Spectral& spectral() const { return spectral_; }

 private:
  void sizeTransform(std::size_t n);
  void transform(const float* frame, std::size_t n);
  void readSpectrum(std::size_t n);

  EngineConfig config_{};
  // float32 to mirror logic/mpm.ts Float32Array nsdf exactly (acf is
  // accumulated in double, matching JS number, then narrowed on store).
  std::vector<float> nsdf_{};
  std::vector<std::size_t> maxPositions_{};  // per-hump local-max lags
  Fft fft_{};
  std::vector<double> re_{};      // transform scratch, sized in configure
  std::vector<double> im_{};
  std::vector<double> power_{};   // |X|^2, kept for the spectral readings
  std::vector<double> lastPower_{};  // the frame before, for flux
  std::vector<double> energy_{};  // prefix sums of x^2, for the NSDF divisor
  Spectral spectral_{};
  bool hasPrevious_ = false;
};

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_MPM_H
