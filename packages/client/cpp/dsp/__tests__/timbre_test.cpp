// timbre_test.cpp — how bright a window is, as a frequency.
//
// The one number that separates a "puh" from a "tss". Both are unvoiced and
// neither has a fundamental, so every other reading the engine produces says
// the same thing about them.
//
//   c++ -std=c++17 -O2 -I. __tests__/timbre_test.cpp -o dsp_timbre_test

#include <cmath>
#include <cstdio>
#include <vector>

#include "timbre.h"

using micdrp::dsp::kNoBrightness;
using micdrp::dsp::windowBrightnessHz;

namespace {

int failures = 0;
constexpr double RATE = 44100.0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

void near(double got, double want, double tol, const char* what) {
  if (std::fabs(got - want) > tol) {
    std::printf("FAIL: %s (got %.1f, wanted %.1f)\n", what, got, want);
    ++failures;
  }
}

std::vector<float> sine(double hz, std::size_t count) {
  std::vector<float> out(count);
  for (std::size_t i = 0; i < count; ++i) {
    out[i] = static_cast<float>(
        std::sin(2.0 * M_PI * hz * static_cast<double>(i) / RATE));
  }
  return out;
}

/** Noise with its energy pushed high or low, by how often it alternates. */
std::vector<float> noise(std::size_t flipEvery, std::size_t count) {
  std::vector<float> out(count);
  float value = 0.5f;
  for (std::size_t i = 0; i < count; ++i) {
    if (i % flipEvery == 0) {
      value = -value;
    }
    out[i] = value;
  }
  return out;
}

}  // namespace

int main() {
  // On a pitched note it lands near the fundamental, which is the sanity
  // check that the arithmetic is right.
  const std::vector<float> a440 = sine(440.0, 2048);
  near(windowBrightnessHz(a440.data(), a440.size(), RATE), 440.0, 15.0,
       "a 440Hz tone reads about 440");

  const std::vector<float> a110 = sine(110.0, 2048);
  near(windowBrightnessHz(a110.data(), a110.size(), RATE), 110.0, 15.0,
       "and a low one reads low");

  // The case it exists for: two unpitched sounds, told apart.
  const std::vector<float> puh = noise(64, 2048);   // slow alternation, low
  const std::vector<float> tss = noise(4, 2048);    // fast alternation, high
  const double low = windowBrightnessHz(puh.data(), puh.size(), RATE);
  const double high = windowBrightnessHz(tss.data(), tss.size(), RATE);
  check(high > low * 4.0, "a hissed sound reads far brighter than a thumped one");

  // Silence must not read as the brightest thing in the take. Every sample is
  // exactly zero, and counting those as crossings would do precisely that.
  const std::vector<float> silence(2048, 0.0f);
  check(windowBrightnessHz(silence.data(), silence.size(), RATE) == kNoBrightness,
        "silence has no brightness, rather than infinite brightness");

  check(windowBrightnessHz(nullptr, 0, RATE) == kNoBrightness,
        "no window reads as nothing");
  check(windowBrightnessHz(a440.data(), 1, RATE) == kNoBrightness,
        "one sample is not a rate");
  check(windowBrightnessHz(a440.data(), a440.size(), 0.0) == kNoBrightness,
        "and neither is a window with no sample rate");

  if (failures > 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("TIMBRE OK\n");
  return 0;
}
