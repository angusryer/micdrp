// level_test.cpp — how loud a window was, in dBFS.
//
// The reading has to be a ratio, because that is what an accent is: the
// difference between the stressed beat of a count-in and the ones around it is
// how many times louder it was, not how many units. dB is that difference
// expressed as a number you can subtract.
//
//   c++ -std=c++17 -O2 -I. mpm.cpp notes.cpp ring_buffer.cpp pitch_engine.cpp \
//       __tests__/level_test.cpp -o dsp_level_test && ./dsp_level_test

#include <cmath>
#include <cstdio>
#include <vector>

#include "pitch_engine.h"

using micdrp::dsp::kSilenceDb;
using micdrp::dsp::windowLevelDb;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

void near(double got, double want, double tol, const char* what) {
  if (std::fabs(got - want) > tol) {
    std::printf("FAIL: %s (got %.3f, wanted %.3f)\n", what, got, want);
    ++failures;
  }
}

std::vector<float> sine(double amplitude, std::size_t count) {
  std::vector<float> out(count);
  for (std::size_t i = 0; i < count; ++i) {
    out[i] = static_cast<float>(
        amplitude * std::sin(2.0 * M_PI * 8.0 * static_cast<double>(i) /
                             static_cast<double>(count)));
  }
  return out;
}

}  // namespace

int main() {
  // A full-scale sine is 1/sqrt(2) RMS, which is -3.01 dBFS.
  const std::vector<float> loud = sine(1.0, 1024);
  near(windowLevelDb(loud.data(), loud.size()), -3.01, 0.05,
       "a full-scale sine reads just under zero");

  // Halving the amplitude is -6 dB, whatever the starting point. This is the
  // property everything downstream depends on.
  const std::vector<float> half = sine(0.5, 1024);
  near(windowLevelDb(half.data(), half.size()) -
           windowLevelDb(loud.data(), loud.size()),
       -6.02, 0.05, "half the amplitude is six dB down");

  const std::vector<float> quarter = sine(0.25, 1024);
  near(windowLevelDb(quarter.data(), quarter.size()) -
           windowLevelDb(half.data(), half.size()),
       -6.02, 0.05, "and again, from anywhere");

  // Silence is negative infinity, which nothing downstream can average or
  // compare. It reads as the floor instead.
  const std::vector<float> silence(1024, 0.0f);
  check(windowLevelDb(silence.data(), silence.size()) == kSilenceDb,
        "silence reads as the floor, not as minus infinity");
  check(std::isfinite(windowLevelDb(silence.data(), silence.size())),
        "the floor is a number");

  // Anything quieter than the floor is still the floor.
  const std::vector<float> whisper = sine(1e-9, 1024);
  check(windowLevelDb(whisper.data(), whisper.size()) == kSilenceDb,
        "nothing reads below the floor");

  check(windowLevelDb(nullptr, 0) == kSilenceDb, "no window reads as silence");
  check(windowLevelDb(loud.data(), 0) == kSilenceDb, "an empty window too");

  // A pitch sample defaults to silence rather than to zero dB, so a frame
  // that never had a level measured cannot claim to have been the loudest
  // thing in the take.
  const micdrp::dsp::PitchSample fresh;
  check(fresh.levelDb == kSilenceDb, "an unmeasured frame is silent, not loud");

  if (failures > 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("LEVEL OK\n");
  return 0;
}
