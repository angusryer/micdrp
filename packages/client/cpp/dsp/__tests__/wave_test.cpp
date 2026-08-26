// wave_test.cpp — the shapes a voice speaks in (INV-NOTES-144).
//
//   c++ -std=c++17 -O2 -I. __tests__/wave_test.cpp -o t && ./t
//
// The band-limiting is the part worth testing: a naive saw sounds fine in a
// waveform viewer and like a metallic buzz at 55Hz, and the difference is only
// visible in the spectrum.

#include "wave.h"
#include "fft.h"

#include <cmath>
#include <cstdio>
#include <vector>

using micdrp::Wave;
using micdrp::waveSample;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

constexpr double kRate = 48000.0;

/// One cycle-accurate block of a waveform at a given pitch.
std::vector<float> render(Wave wave, double hz, std::size_t frames) {
  std::vector<float> out(frames);
  const float dt = static_cast<float>(hz / kRate);
  float phase = 0.0f;
  std::uint32_t noise = 12345u;
  for (std::size_t i = 0; i < frames; ++i) {
    out[i] = waveSample(wave, phase, dt, noise);
    phase += dt;
    if (phase >= 1.0f) {
      phase -= 1.0f;
    }
  }
  return out;
}

/// How much energy sits above `hz`, as a fraction of the whole.
double energyAbove(const std::vector<float>& block, double hz) {
  micdrp::dsp::Fft fft;
  const std::size_t n = 4096;
  fft.configure(n);
  std::vector<double> re(n, 0.0), im(n, 0.0);
  for (std::size_t i = 0; i < n && i < block.size(); ++i) {
    // Hann, so the fundamental does not smear across the whole spectrum and
    // hide what we are looking for.
    const double w = 0.5 * (1.0 - std::cos(2.0 * M_PI * i / (n - 1)));
    re[i] = block[i] * w;
  }
  fft.forward(re.data(), im.data());
  double total = 0.0, above = 0.0;
  for (std::size_t k = 1; k < n / 2; ++k) {
    const double power = re[k] * re[k] + im[k] * im[k];
    total += power;
    if (k * kRate / n > hz) {
      above += power;
    }
  }
  return total > 0.0 ? above / total : 0.0;
}

void eachShapeIsItsOwn() {
  const auto sine = render(Wave::Sine, 220.0, 512);
  const auto saw = render(Wave::Saw, 220.0, 512);
  const auto square = render(Wave::Square, 220.0, 512);
  double sawDiff = 0.0, squareDiff = 0.0;
  for (std::size_t i = 0; i < sine.size(); ++i) {
    sawDiff += std::fabs(saw[i] - sine[i]);
    squareDiff += std::fabs(square[i] - sine[i]);
  }
  // Five parts playing at once were five things the ear had only pitch and
  // level to separate.
  check(sawDiff > 50.0, "a saw is not a sine");
  check(squareDiff > 50.0, "a square is not a sine");
}

void everyShapeStaysInsideFullScale() {
  for (Wave wave : {Wave::Sine, Wave::Triangle, Wave::Square, Wave::Saw,
                    Wave::Noise}) {
    const auto block = render(wave, 220.0, 2048);
    float peak = 0.0f;
    for (float s : block) {
      peak = std::max(peak, std::fabs(s));
    }
    // PolyBLEP overshoots a little at the edges; anything past this would
    // clip against the other voices rather than sitting under them.
    check(peak <= 1.35f, "a shape stays inside full scale");
  }
}

void aBassSawDoesNotBuzz() {
  // 55Hz on a 48kHz engine: a naive saw folds hundreds of partials back down
  // the spectrum, and they land exactly where a voice does.
  const auto blepped = render(Wave::Saw, 55.0, 4096);
  const double aliased = energyAbove(blepped, 12000.0);
  check(aliased < 0.02, "a low saw has little energy up where aliases land");
}

void aSquareIsCleanerThanNaive() {
  const auto block = render(Wave::Square, 55.0, 4096);
  check(energyAbove(block, 12000.0) < 0.05, "a low square is band-limited too");
}

void noiseHasNoPitch() {
  const auto block = render(Wave::Noise, 220.0, 4096);
  // Spread rather than concentrated: a drum stand-in that had a fundamental
  // would be a note, and would clash with the harmony it plays under.
  check(energyAbove(block, 12000.0) > 0.2, "noise is spread across the band");
}

void aTriangleIsQuietAboveItsFundamental() {
  const auto block = render(Wave::Triangle, 220.0, 4096);
  check(energyAbove(block, 4000.0) < 0.02, "a triangle falls away quickly");
}

}  // namespace

int main() {
  eachShapeIsItsOwn();
  everyShapeStaysInsideFullScale();
  aBassSawDoesNotBuzz();
  aSquareIsCleanerThanNaive();
  noiseHasNoPitch();
  aTriangleIsQuietAboveItsFundamental();

  if (failures > 0) {
    std::printf("%d check(s) failed\n", failures);
    return 1;
  }
  std::printf("WAVE OK\n");
  return 0;
}
