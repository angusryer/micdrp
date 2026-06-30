// parity_test.cpp — host-side parity check for the C++ DSP core.
//
// Asserts the C++ port (Mpm, frequencyToNote, PitchEngine) matches the pure-TS
// reference in packages/logic/src/{mpm,notes}.ts within:
//   * 1e-4 Hz on detected frequency,
//   * 1 cent on note math,
//   * exact match on midi.
//
// The expected numbers below are the golden values emitted by the TS oracle
// (see cpp/dsp/__tests__/fixtures.json and the regeneration recipe in
// cpp/dsp/README.md). They are NOT recomputed here so the test genuinely
// pins the C++ output to the TS reference rather than to itself.
//
// This is a dependency-free STL program — no gtest. It returns 0 on success and
// prints "PARITY OK"; on any mismatch it prints the offending case and returns
// a non-zero exit code. Build/run via cpp/dsp/CMakeLists.txt (see README).

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

#include "../mpm.h"
#include "../notes.h"
#include "../pitch_engine.h"

namespace {

// M_PI is not guaranteed under strict -std=c++17; define a local constant.
constexpr double kPi = 3.14159265358979323846;

constexpr double kSampleRate = 44100.0;
constexpr std::size_t kFrameSize = 2048;
constexpr double kHzTol = 1e-4;

int g_failures = 0;

// Generate a sine into a float32 frame EXACTLY as the TS test does:
// values are computed in double (std::sin) then narrowed to float on store,
// mirroring JS `Float32Array[i] = Math.sin(...)`. Bit-identical narrowing is
// what keeps the NSDF — and thus the detected frequency — within 1e-4 Hz.
std::vector<float> sine(double freq, std::size_t n) {
  std::vector<float> out(n);
  for (std::size_t i = 0; i < n; ++i) {
    const double v =
        std::sin((2.0 * kPi * freq * static_cast<double>(i)) / kSampleRate);
    out[i] = static_cast<float>(v);
  }
  return out;
}

void expectClose(const char* what, double got, double want, double tol) {
  if (std::fabs(got - want) > tol) {
    std::printf("FAIL %s: got %.10g, want %.10g (tol %.3g)\n", what, got, want,
                tol);
    ++g_failures;
  }
}

void expectEqInt(const char* what, int got, int want) {
  if (got != want) {
    std::printf("FAIL %s: got %d, want %d\n", what, got, want);
    ++g_failures;
  }
}

// --- MPM parity cases (oracle: detectPitch over a 2048-sample sine, no bounds).
struct MpmCase {
  double inputFreq;
  double frequency;
  double clarity;
  int midi;
  int cents;
};

const std::vector<MpmCase> kMpmCases = {
    {110.0, 109.99989220957838, 0.99999997243407, 45, 0},
    {220.0, 219.99998798925762, 0.9999999645328327, 57, 0},
    {440.0, 439.9987154938306, 1.0, 69, 0},
    {660.0, 659.9970537314432, 0.9999993639554986, 76, 2},
};

// Build a config that matches the oracle call detectPitch(sine, SR) with NO
// frequency bounds: widen min/max so the C++ bound checks never reject.
micdrp::dsp::EngineConfig unboundedConfig() {
  micdrp::dsp::EngineConfig cfg;
  cfg.sampleRateHz = kSampleRate;
  cfg.frameSize = kFrameSize;
  cfg.hopSize = kFrameSize / 2;
  cfg.minFrequencyHz = 0.0;
  cfg.maxFrequencyHz = 1e12;
  cfg.clarityThreshold = 0.9;  // matches TS default
  return cfg;
}

void testMpmParity() {
  micdrp::dsp::Mpm mpm;
  mpm.configure(unboundedConfig());
  for (const auto& c : kMpmCases) {
    const auto frame = sine(c.inputFreq, kFrameSize);
    const micdrp::dsp::PitchResult r = mpm.detect(frame.data(), kFrameSize);
    if (!r.voiced) {
      std::printf("FAIL mpm %.0fHz: unvoiced, expected a detection\n",
                  c.inputFreq);
      ++g_failures;
      continue;
    }
    char label[64];
    std::snprintf(label, sizeof(label), "mpm %.0fHz frequency", c.inputFreq);
    expectClose(label, r.frequencyHz, c.frequency, kHzTol);
    std::snprintf(label, sizeof(label), "mpm %.0fHz clarity", c.inputFreq);
    expectClose(label, r.clarity, c.clarity, 1e-4);

    // Note math parity (frequencyToNote on the detected frequency).
    const micdrp::dsp::NoteReading note =
        micdrp::dsp::frequencyToNote(r.frequencyHz);
    std::snprintf(label, sizeof(label), "mpm %.0fHz midi", c.inputFreq);
    expectEqInt(label, note.midi, c.midi);
    std::snprintf(label, sizeof(label), "mpm %.0fHz cents", c.inputFreq);
    // 1 cent tolerance on the integer cents value.
    if (std::abs(note.cents - c.cents) > 1) {
      std::printf("FAIL %s: got %d, want %d (tol 1)\n", label, note.cents,
                  c.cents);
      ++g_failures;
    }
  }
}

// --- Bound-rejection parity (mirrors mpm.test honours min/maxFrequency).
void testBounds() {
  // maxFrequency: 200 must reject a 440Hz sine.
  {
    micdrp::dsp::EngineConfig cfg = unboundedConfig();
    cfg.maxFrequencyHz = 200.0;
    micdrp::dsp::Mpm mpm;
    mpm.configure(cfg);
    const auto frame = sine(440.0, kFrameSize);
    const auto r = mpm.detect(frame.data(), kFrameSize);
    if (r.voiced) {
      std::printf("FAIL bounds: 440Hz accepted under maxFrequency=200\n");
      ++g_failures;
    }
  }
  // minFrequency: 200 must reject a 110Hz sine.
  {
    micdrp::dsp::EngineConfig cfg = unboundedConfig();
    cfg.minFrequencyHz = 200.0;
    micdrp::dsp::Mpm mpm;
    mpm.configure(cfg);
    const auto frame = sine(110.0, kFrameSize);
    const auto r = mpm.detect(frame.data(), kFrameSize);
    if (r.voiced) {
      std::printf("FAIL bounds: 110Hz accepted under minFrequency=200\n");
      ++g_failures;
    }
  }
  // Silence must be unvoiced.
  {
    micdrp::dsp::Mpm mpm;
    mpm.configure(unboundedConfig());
    std::vector<float> silence(kFrameSize, 0.0f);
    const auto r = mpm.detect(silence.data(), kFrameSize);
    if (r.voiced) {
      std::printf("FAIL bounds: silence reported voiced\n");
      ++g_failures;
    }
  }
}

// --- Standalone note-conversion parity (oracle: notes.ts frequencyToNote).
struct NoteCase {
  double f;
  int midi;
  int cents;
};
const std::vector<NoteCase> kNoteCases = {
    {440.0, 69, 0},
    {261.6256, 60, 0},
    {443.0, 69, 12},
    {437.0, 69, -12},
};

void testNoteParity() {
  for (const auto& c : kNoteCases) {
    const auto note = micdrp::dsp::frequencyToNote(c.f);
    char label[64];
    std::snprintf(label, sizeof(label), "note %.4fHz midi", c.f);
    expectEqInt(label, note.midi, c.midi);
    std::snprintf(label, sizeof(label), "note %.4fHz cents", c.f);
    if (std::abs(note.cents - c.cents) > 1) {
      std::printf("FAIL %s: got %d, want %d (tol 1)\n", label, note.cents,
                  c.cents);
      ++g_failures;
    }
  }
  // A4 round-trips through frequencyToMidi/midiToFrequency.
  expectClose("midiToFrequency(69)", micdrp::dsp::midiToFrequency(69), 440.0,
              1e-9);
  expectClose("frequencyToMidi(440)", micdrp::dsp::frequencyToMidi(440.0), 69.0,
              1e-9);
}

// --- PitchEngine integration: feed a 440Hz stream and confirm it emits a
// PitchSample matching the MPM detection, with a sane monotonic timestamp.
void testPitchEngine() {
  micdrp::dsp::EngineConfig cfg = unboundedConfig();
  micdrp::dsp::PitchEngine engine;
  engine.configure(cfg);

  // Push several frames' worth of 440Hz audio.
  const auto block = sine(440.0, kFrameSize * 3);
  const std::size_t pushed = engine.push(block.data(), block.size());
  if (pushed == 0) {
    std::printf("FAIL pitch_engine: push accepted nothing\n");
    ++g_failures;
    return;
  }

  bool sawVoiced = false;
  double prevTs = -1.0;
  while (auto s = engine.tryAnalyze()) {
    if (s->timestampMs < prevTs) {
      std::printf("FAIL pitch_engine: timestamp went backwards (%.3f < %.3f)\n",
                  s->timestampMs, prevTs);
      ++g_failures;
    }
    prevTs = s->timestampMs;
    if (s->voiced) {
      sawVoiced = true;
      // The engine slides overlapping windows across a continuous sine, so each
      // window has a different phase than the single-frame oracle; we therefore
      // assert the musical answer (lands on 440Hz / A4) rather than bit-exact
      // parity with the standalone fixture. Bit-exact parity is covered by
      // testMpmParity above, which feeds Mpm the identical 0-phase frame.
      expectClose("pitch_engine 440Hz frequency", s->frequencyHz, 440.0, 0.1);
      expectEqInt("pitch_engine 440Hz midi", s->midi, 69);
    }
  }
  if (!sawVoiced) {
    std::printf("FAIL pitch_engine: never emitted a voiced sample\n");
    ++g_failures;
  }
}

}  // namespace

int main() {
  testMpmParity();
  testBounds();
  testNoteParity();
  testPitchEngine();

  if (g_failures == 0) {
    std::printf("PARITY OK\n");
    return EXIT_SUCCESS;
  }
  std::printf("PARITY FAILED: %d assertion(s)\n", g_failures);
  return EXIT_FAILURE;
}
