// spectral_test.cpp — what the spectrum says about a window.
//
// These are the readings periodicity cannot make. Whether a sound is pitched
// at all, where its energy sits, and whether something new just started are
// three different questions, and the pitch detector answers none of them.
//
//   c++ -std=c++17 -O2 -I. mpm.cpp notes.cpp __tests__/spectral_test.cpp \
//       -o dsp_spectral_test

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

#include "mpm.h"

using micdrp::dsp::EngineConfig;
using micdrp::dsp::Mpm;

namespace {

int failures = 0;
constexpr std::size_t N = 2048;

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

EngineConfig config() {
  EngineConfig cfg;
  cfg.frameSize = N;
  cfg.hopSize = N / 2;
  return cfg;
}

std::vector<float> tone(double hz) {
  std::vector<float> out(N);
  for (std::size_t i = 0; i < N; ++i) {
    out[i] = static_cast<float>(
        std::sin(2.0 * M_PI * hz * static_cast<double>(i) / 44100.0));
  }
  return out;
}

/** White-ish noise, from a fixed seed so the test says the same thing twice. */
std::vector<float> noise(unsigned seed, float scale = 1.0f) {
  std::vector<float> out(N);
  unsigned state = seed;
  for (std::size_t i = 0; i < N; ++i) {
    state = state * 1664525u + 1013904223u;
    out[i] = scale * ((static_cast<float>(state >> 8) / 8388608.0f) - 1.0f);
  }
  return out;
}

const std::vector<float> silence(N, 0.0f);

}  // namespace

int main() {
  // Centroid: where the energy is. The one reading that separates two
  // unpitched sounds from each other.
  {
    Mpm mpm;
    mpm.configure(config());
    const std::vector<float> low = tone(220.0);
    mpm.detect(low.data(), N);
    near(mpm.spectral().centroidHz, 220.0, 30.0,
         "a 220Hz tone has its energy at 220Hz");

    const std::vector<float> high = tone(3000.0);
    mpm.detect(high.data(), N);
    near(mpm.spectral().centroidHz, 3000.0, 120.0, "and a high one high up");
  }

  // Flatness: whether it is pitched at all, said directly. Periodicity
  // answers this only by inference.
  {
    Mpm mpm;
    mpm.configure(config());
    const std::vector<float> pure = tone(440.0);
    mpm.detect(pure.data(), N);
    const double tonal = mpm.spectral().flatness;

    const std::vector<float> hiss = noise(12345u);
    mpm.detect(hiss.data(), N);
    const double noisy = mpm.spectral().flatness;

    check(tonal < 0.1, "a pure tone is not flat");
    check(noisy > tonal * 5.0, "noise is far flatter than a tone");
  }

  // Rolloff: separates a bright sound from one that is merely loud low down.
  {
    Mpm mpm;
    mpm.configure(config());
    const std::vector<float> low = tone(200.0);
    mpm.detect(low.data(), N);
    const double lowRolloff = mpm.spectral().rolloffHz;
    const std::vector<float> high = tone(5000.0);
    mpm.detect(high.data(), N);
    check(mpm.spectral().rolloffHz > lowRolloff * 4.0,
          "a high sound rolls off far higher than a low one");
  }

  // Flux: something new started. This is what an attack is, and it is the
  // reading that does not need a level threshold guessed for it.
  {
    Mpm mpm;
    mpm.configure(config());
    const std::vector<float> steady = tone(440.0);
    mpm.detect(steady.data(), N);
    mpm.detect(steady.data(), N);
    const double sustaining = mpm.spectral().fluxDb;

    const std::vector<float> other = noise(999u);
    mpm.detect(other.data(), N);
    const double onset = mpm.spectral().fluxDb;
    check(onset > sustaining,
          "a spectrum that changed reads as more of an onset than one that did not");
  }

  // Silence must say nothing rather than something arbitrary. Every one of
  // these is a division by the total energy.
  {
    Mpm mpm;
    mpm.configure(config());
    mpm.detect(silence.data(), N);
    check(mpm.spectral().centroidHz == 0.0, "silence has no centroid");
    check(mpm.spectral().flatness == 0.0, "and no flatness");
    check(mpm.spectral().rolloffHz == 0.0, "and no rolloff");
    check(std::isfinite(mpm.spectral().fluxDb), "and a finite flux");
  }

  // The readings must not depend on how loud the take was recorded. A quiet
  // singer and a loud one make the same sound.
  {
    Mpm mpm;
    mpm.configure(config());
    const std::vector<float> loud = noise(4242u, 1.0f);
    mpm.detect(loud.data(), N);
    const double loudCentroid = mpm.spectral().centroidHz;
    const double loudFlatness = mpm.spectral().flatness;

    const std::vector<float> quiet = noise(4242u, 0.01f);
    mpm.detect(quiet.data(), N);
    near(mpm.spectral().centroidHz, loudCentroid, 1.0,
         "the same sound quieter has the same centroid");
    near(mpm.spectral().flatness, loudFlatness, 0.05,
         "and the same flatness");
  }

  if (failures > 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("SPECTRAL OK\n");
  return 0;
}
