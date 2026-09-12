// engine_chunking_test.cpp — the engine gives the same frames however the
// audio arrives, as long as the ring is never asked to hold more than it can
// (INV-NOTES-261).
//
// The capture pushes a hop at a time from the microphone. analyzeFile used to
// push eight windows at a time from a file into a ring that holds four, and
// ignored push() telling it so — dropping half of every chunk, silently, on
// every re-read. So two things are held here: every feed that fits gives
// byte-identical samples, and a feed that does not fit is *reported* short,
// so no caller can miss it again.
//
//   c++ -std=c++17 -O2 -I. mpm.cpp notes.cpp ring_buffer.cpp pitch_engine.cpp \
//       __tests__/engine_chunking_test.cpp -o dsp_chunking && ./dsp_chunking
#include <cmath>
#include <cstdio>
#include <cstring>
#include <vector>

#include "pitch_engine.h"

using namespace micdrp::dsp;

namespace {

constexpr double kPi = 3.14159265358979323846;

// A sung-ish signal: a note, a glide, a breath, another note. Computed in
// double and narrowed on store, as the capture's float32 buffers are.
std::vector<float> phrase(double rate) {
  std::vector<float> out;
  const double seconds = 3.0;
  const std::size_t n = (std::size_t)(rate * seconds);
  out.reserve(n);
  double phase = 0.0;
  for (std::size_t i = 0; i < n; ++i) {
    const double t = (double)i / rate;
    double hz = 0.0, gain = 0.0;
    if (t < 0.9) { hz = 220.0; gain = 0.4; }
    else if (t < 1.6) { hz = 220.0 + (t - 0.9) * 120.0; gain = 0.4; }
    else if (t < 2.0) { hz = 0.0; gain = 0.0; }
    else { hz = 330.0; gain = 0.35; }
    phase += 2.0 * kPi * hz / rate;
    const double v = gain * (std::sin(phase) + 0.3 * std::sin(2.0 * phase));
    out.push_back((float)v);
  }
  return out;
}

// Feed in `chunk`-sized pushes, draining after each. Returns the samples
// and whether every push was accepted in full.
struct Fed {
  std::vector<PitchSample> samples;
  bool everyPushAccepted = true;
};

Fed run(const std::vector<float>& pcm, std::size_t chunk) {
  EngineConfig cfg;
  cfg.sampleRateHz = 48000.0;
  PitchEngine engine;
  engine.configure(cfg);
  Fed out;
  for (std::size_t at = 0; at < pcm.size(); at += chunk) {
    const std::size_t n = std::min(chunk, pcm.size() - at);
    if (engine.push(pcm.data() + at, n) != n) out.everyPushAccepted = false;
    while (auto s = engine.tryAnalyze()) out.samples.push_back(*s);
  }
  return out;
}

bool same(const PitchSample& a, const PitchSample& b) {
  return std::memcmp(&a, &b, sizeof(PitchSample)) == 0;
}

int compare(const char* label, const std::vector<PitchSample>& a,
            const std::vector<PitchSample>& b) {
  if (a.size() != b.size()) {
    std::printf("FAIL %s: %zu frames vs %zu\n", label, a.size(), b.size());
    return 1;
  }
  for (std::size_t i = 0; i < a.size(); ++i) {
    if (!same(a[i], b[i])) {
      std::printf("FAIL %s: frame %zu differs (%.6f Hz vs %.6f Hz)\n", label, i,
                  a[i].frequencyHz, b[i].frequencyHz);
      return 1;
    }
  }
  return 0;
}

}  // namespace

int main() {
  const auto pcm = phrase(48000.0);
  EngineConfig cfg;
  // Everything the ring can hold between drains: it is sized to four
  // windows, so four windows is the most any one push may carry.
  const auto byHop = run(pcm, cfg.hopSize);          // the microphone
  const auto byTwoHops = run(pcm, cfg.hopSize * 2);
  const auto byFrame = run(pcm, cfg.frameSize);
  const auto byRing = run(pcm, cfg.frameSize * 4);   // the most that fits
  const auto ragged = run(pcm, 733);                 // nothing aligned

  int failures = 0;
  failures += compare("hop vs two hops", byHop.samples, byTwoHops.samples);
  failures += compare("hop vs frame", byHop.samples, byFrame.samples);
  failures += compare("hop vs ring", byHop.samples, byRing.samples);
  failures += compare("hop vs ragged", byHop.samples, ragged.samples);
  for (const Fed* f : {&byHop, &byTwoHops, &byFrame, &byRing, &ragged}) {
    if (!f->everyPushAccepted) {
      std::printf("FAIL: a push that fits the ring was cut short\n");
      failures += 1;
      break;
    }
  }
  if (byHop.samples.empty()) {
    std::printf("FAIL: no frames analysed\n");
    failures += 1;
  }

  // And the other half: a push the ring cannot hold is reported short, so a
  // caller that reads the return value cannot lose audio without knowing.
  const auto overflowing = run(pcm, cfg.frameSize * 8);  // what analyzeFile did
  if (overflowing.everyPushAccepted) {
    std::printf("FAIL: an overflowing push was reported as accepted in full\n");
    failures += 1;
  }
  if (overflowing.samples.size() == byHop.samples.size()) {
    std::printf("FAIL: an overflowing feed lost nothing, so the ring is not the guard\n");
    failures += 1;
  }

  if (failures == 0) {
    std::printf("CHUNKING OK (%zu frames; overflow reported)\n", byHop.samples.size());
  }
  return failures == 0 ? 0 : 1;
}
