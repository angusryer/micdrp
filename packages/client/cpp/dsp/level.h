// level.h — how loud an analysed window was, in dBFS.
//
// Header-only and on its own, because two different engines need it and there
// must be exactly one answer (Axiom 2). The bridge's streaming detector
// (ios/StreamingPitch.h) is what capture actually runs; cpp/dsp/pitch_engine.h
// is the fuller, real-time-safe one that nothing has been wired to yet. Both
// report a level, and a second implementation of the same measurement would be
// free to disagree with the first — which for a reading whose whole purpose is
// comparing one note against another is the one failure that matters.
//
// Inline rather than a .cpp so including it is the whole cost: the bridge
// compiles under Xcode's own target and does not build the dsp sources.

#ifndef MICDRP_DSP_LEVEL_H
#define MICDRP_DSP_LEVEL_H

#include <algorithm>
#include <cmath>
#include <cstddef>

namespace micdrp::dsp {

// The floor a level is reported at. Digital silence is negative infinity,
// which is not a number anything downstream can average or compare, so
// everything quieter than this reads as this.
constexpr double kSilenceDb = -80.0;

// RMS of a window, in dBFS. A full-scale sine reads about -3 dB.
//
// Measured over the same window the pitch came from, so a note's loudness is
// the loudness of the frames that made it that note (INV-PITCH-020).
inline double windowLevelDb(const float* samples, std::size_t count) {
  if (samples == nullptr || count == 0) {
    return kSilenceDb;
  }
  double sum = 0.0;
  for (std::size_t i = 0; i < count; ++i) {
    const double v = static_cast<double>(samples[i]);
    sum += v * v;
  }
  const double rms = std::sqrt(sum / static_cast<double>(count));
  if (!(rms > 0.0)) {
    return kSilenceDb;
  }
  return std::max(kSilenceDb, 20.0 * std::log10(rms));
}

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_LEVEL_H
