// timbre.h — how bright a window is, as a frequency.
//
// The zero-crossing rate, expressed as the frequency a sine wave crossing that
// often would have. For a pitched note it lands near the fundamental; for
// noise it tracks where the energy sits, which is what separates a "puh" from
// a "tss" — both are unpitched, and neither has a fundamental to report
// (INV-PITCH-025).
//
// Chosen over a spectral centroid because a centroid needs an FFT, and the
// engine has none: MPM works in the time domain. An FFT per hop would be a new
// transform, a new buffer and a new allocation on a path that is deliberately
// free of all three, to answer a question this answers in one pass over
// samples already in cache.
//
// It is a proxy, not a centroid, and is named for what it measures rather than
// for what it approximates.

#ifndef MICDRP_DSP_TIMBRE_H
#define MICDRP_DSP_TIMBRE_H

#include <cstddef>

namespace micdrp::dsp {

// Reported when a window is too short or too quiet to have a rate worth
// stating. Zero rather than a guess: nothing downstream should read it as
// "very low", which is a claim about the sound.
constexpr double kNoBrightness = 0.0;

inline double windowBrightnessHz(const float* samples, std::size_t count,
                                 double sampleRateHz) {
  if (samples == nullptr || count < 2 || sampleRateHz <= 0.0) {
    return kNoBrightness;
  }
  std::size_t crossings = 0;
  for (std::size_t i = 1; i < count; ++i) {
    // Sign change, counting a sample sitting exactly on zero as belonging to
    // whichever side preceded it — otherwise silence reads as a crossing on
    // every sample and comes back as the brightest thing in the take.
    const bool wasNegative = samples[i - 1] < 0.0f;
    const bool isNegative = samples[i] < 0.0f;
    if (wasNegative != isNegative) {
      ++crossings;
    }
  }
  // A sine crosses zero twice per cycle, so half the rate is the frequency it
  // would have had.
  const double seconds = static_cast<double>(count) / sampleRateHz;
  return seconds > 0.0 ? static_cast<double>(crossings) / (2.0 * seconds)
                       : kNoBrightness;
}

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_TIMBRE_H
