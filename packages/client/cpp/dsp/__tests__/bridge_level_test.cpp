// bridge_level_test.cpp — the detector capture actually runs reports levels.
//
// There are two pitch engines. cpp/dsp/pitch_engine.h is the fuller,
// real-time-safe one; ios/StreamingPitch.h is the one the bridge drives, and
// the duplication is documented at the top of that header. Testing only the
// first is how a level that never reached the app passed everything: it
// compiled, its unit tests were green, and the archive was the first thing to
// notice the field did not exist on the struct the bridge marshals.
//
// So this covers the engine that runs, through the same shared measurement.
//
//   c++ -std=c++17 -O2 -I. -I../../ios mpm.cpp notes.cpp \
//       __tests__/bridge_level_test.cpp -o dsp_bridge_level_test
#include <cmath>
#include <cstdio>
#include <vector>

#include "StreamingPitch.h"

using micdrp::bridge::EngineConfig;
using micdrp::bridge::PitchEngine;
using micdrp::bridge::PitchSample;
using micdrp::dsp::kSilenceDb;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

/** A steady tone at a given amplitude, long enough to fill several windows. */
std::vector<float> tone(double amplitude, double hz, double rate,
                        std::size_t count) {
  std::vector<float> out(count);
  for (std::size_t i = 0; i < count; ++i) {
    out[i] = static_cast<float>(
        amplitude * std::sin(2.0 * M_PI * hz * static_cast<double>(i) / rate));
  }
  return out;
}

std::vector<PitchSample> analyse(const std::vector<float>& pcm) {
  EngineConfig cfg;
  PitchEngine engine(cfg);
  std::vector<PitchSample> out;
  engine.push(pcm.data(), static_cast<int>(pcm.size()), 0.0, out);
  return out;
}

}  // namespace

int main() {
  EngineConfig cfg;
  const std::size_t enough = static_cast<std::size_t>(cfg.frameSize) * 4;

  const std::vector<PitchSample> loud =
      analyse(tone(0.5, 220.0, cfg.sampleRateHz, enough));
  check(!loud.empty(), "the bridge engine emits frames at all");
  check(loud.front().levelDb > kSilenceDb,
        "a frame carries a level, not the silence it starts at");

  const std::vector<PitchSample> quiet =
      analyse(tone(0.125, 220.0, cfg.sampleRateHz, enough));
  check(!quiet.empty(), "and again for the quieter take");

  // Two amplitudes a factor of four apart are twelve dB apart, whatever else
  // the engine did to them. This is the property a count-in is read from.
  const double gap = loud.front().levelDb - quiet.front().levelDb;
  check(std::fabs(gap - 12.04) < 0.2,
        "four times the amplitude reads twelve dB louder");

  // Silence reads as the floor rather than as an unmeasured frame masquerading
  // as a loud one.
  const std::vector<float> nothing(enough, 0.0f);
  const std::vector<PitchSample> silent = analyse(nothing);
  check(!silent.empty(), "silence still produces frames");
  check(silent.front().levelDb == kSilenceDb, "and they read as the floor");

  const PitchSample fresh;
  check(fresh.levelDb == kSilenceDb, "an unmeasured frame is silent, not loud");

  if (failures > 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("BRIDGE LEVEL OK\n");
  return 0;
}
