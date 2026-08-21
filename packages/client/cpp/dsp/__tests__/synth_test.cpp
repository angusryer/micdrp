// synth_test.cpp — host test for the shared voice pool (INV-NOTES-028/029).
//
//   cd packages/client/cpp/dsp
//   cmake -S . -B build && cmake --build build && ./build/dsp_synth_test
//
// Or without CMake:
//   c++ -std=c++17 -O2 -I. synth.cpp __tests__/synth_test.cpp -o t && ./t
//
// No audio device is involved: the core produces samples, so everything it
// promises can be checked on a host.

#include "synth.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

using micdrp::Bus;
using micdrp::ScheduledNote;
using micdrp::Synth;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

/// Peak absolute sample over a block — how loud something is, roughly.
float peak(const std::vector<float>& buf) {
  float p = 0.0f;
  for (float s : buf) {
    p = std::max(p, std::fabs(s));
  }
  return p;
}

/// Render `frames` in blocks of `block`, returning everything.
std::vector<float> renderAll(Synth& synth, std::size_t frames, std::size_t block = 256) {
  std::vector<float> out(frames, 0.0f);
  for (std::size_t i = 0; i < frames; i += block) {
    synth.render(out.data() + i, std::min(block, frames - i));
  }
  return out;
}

constexpr double kRate = 48000.0;

void soundsWhatWasScheduled() {
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 24000});
  const auto out = renderAll(synth, 24000);
  check(peak(out) > 0.05f, "a scheduled note is audible");
}

void silentBeforeAndAfter() {
  Synth synth;
  synth.configure(kRate);
  // Half a second in, for a quarter second.
  synth.schedule({Bus::Melody, 440.0f, 24000, 36000});

  std::vector<float> before(1000, 0.0f);
  synth.render(before.data(), before.size());
  check(peak(before) == 0.0f, "silent before a note begins");

  renderAll(synth, 47000);  // through the note and past its end
  std::vector<float> after(1000, 0.0f);
  synth.render(after.data(), after.size());
  check(peak(after) == 0.0f, "silent after a note ends");
}

void oneClockForEveryBus() {
  // The reason the pool exists: two busses given the same start must sound
  // together, not as close together as two graphs can manage (INV-NOTES-028).
  Synth a;
  a.configure(kRate);
  a.setBusLevel(Bus::Chords, 0.0f);
  a.schedule({Bus::Melody, 440.0f, 5000, 20000});
  a.schedule({Bus::Chords, 330.0f, 5000, 20000});
  const auto melodyOnly = renderAll(a, 20000);

  Synth b;
  b.configure(kRate);
  b.setBusLevel(Bus::Melody, 0.0f);
  b.schedule({Bus::Melody, 440.0f, 5000, 20000});
  b.schedule({Bus::Chords, 330.0f, 5000, 20000});
  const auto chordsOnly = renderAll(b, 20000);

  // Each bus starts at the same sample, to the sample.
  std::size_t firstMelody = melodyOnly.size();
  std::size_t firstChords = chordsOnly.size();
  for (std::size_t i = 0; i < melodyOnly.size(); ++i) {
    if (firstMelody == melodyOnly.size() && melodyOnly[i] != 0.0f) firstMelody = i;
    if (firstChords == chordsOnly.size() && chordsOnly[i] != 0.0f) firstChords = i;
  }
  check(firstMelody == firstChords, "both busses start on the same sample");
  // A sine begins at zero amplitude, so the first sample that differs from
  // silence is the one after the start.
  check(firstMelody == 5001, "and on the sample they were scheduled for");
}

void levelMovesWhatIsAlreadySounding() {
  // Mixing is done by ear while listening (INV-NOTES-027).
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 96000});
  const auto loud = renderAll(synth, 24000);
  synth.setBusLevel(Bus::Melody, 0.25f);
  const auto quiet = renderAll(synth, 24000);
  check(peak(quiet) < peak(loud) * 0.5f, "a level change reaches a sounding note");
}

void silenceIsSilent() {
  Synth synth;
  synth.configure(kRate);
  synth.setBusLevel(Bus::Melody, 0.0f);
  synth.schedule({Bus::Melody, 440.0f, 0, 24000});
  const auto out = renderAll(synth, 24000);
  check(peak(out) == 0.0f, "a bus at zero makes no sound at all");
}

void longTakeCostsNoMoreThanShort() {
  // INV-NOTES-029: the pool is fixed, so hundreds of notes cannot become
  // hundreds of anything.
  Synth synth;
  synth.configure(kRate);
  for (int i = 0; i < 800; ++i) {
    const std::int64_t start = i * 2400;  // one note every 50ms
    synth.schedule({Bus::Melody, 220.0f + static_cast<float>(i % 24) * 10.0f,
                    start, start + 2400});
  }
  std::size_t highWater = 0;
  std::vector<float> block(256, 0.0f);
  for (int i = 0; i < 8000; ++i) {
    synth.render(block.data(), block.size());
    highWater = std::max(highWater, synth.activeVoices());
  }
  check(highWater <= micdrp::kMaxVoices, "voices stay within the pool");
  check(highWater > 0, "and the take actually sounded");
}

void overlappingNotesBeyondThePoolDoNotBreak() {
  Synth synth;
  synth.configure(kRate);
  // Far more at once than there are voices: the excess is stolen, not leaked.
  for (int i = 0; i < 200; ++i) {
    synth.schedule({Bus::Chords, 110.0f + static_cast<float>(i), 0, 96000});
  }
  const auto out = renderAll(synth, 4800);
  check(synth.activeVoices() <= micdrp::kMaxVoices, "the pool is never exceeded");
  check(peak(out) <= 1.0f, "the mix never leaves the representable range");
}

void startsAndStopsWithoutClicking() {
  // A step change in amplitude is heard as a tick against the take.
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Audition, 440.0f, 100, 4800});
  const auto out = renderAll(synth, 9600);
  float biggestJump = 0.0f;
  for (std::size_t i = 1; i < out.size(); ++i) {
    biggestJump = std::max(biggestJump, std::fabs(out[i] - out[i - 1]));
  }
  // One sample of a 440Hz sine at full voice level moves far less than this;
  // an un-ramped start or stop moves the whole amplitude at once.
  check(biggestJump < 0.05f, "no discontinuity at a note's edges");
}

void clearingABusLeavesOthersSounding() {
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 96000});
  synth.schedule({Bus::Chords, 330.0f, 0, 96000});
  renderAll(synth, 4800);
  synth.clearBus(Bus::Melody);
  renderAll(synth, 4800);  // let the release finish
  const auto out = renderAll(synth, 4800);
  check(peak(out) > 0.02f, "the other bus keeps sounding");

  synth.setBusLevel(Bus::Chords, 0.0f);
  const auto silent = renderAll(synth, 4800);
  check(peak(silent) == 0.0f, "and the cleared bus contributes nothing");
}

void reconfiguringResets() {
  // Sample positions from another rate describe different moments.
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 0, 96000});
  renderAll(synth, 4800);
  synth.configure(44100.0);
  check(synth.now() == 0, "the clock restarts");
  const auto out = renderAll(synth, 4800);
  check(peak(out) == 0.0f, "and nothing scheduled under the old rate survives");
}

void nonsenseIsIgnored() {
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 1000, 1000});    // zero length
  synth.schedule({Bus::Melody, 440.0f, 2000, 1000});    // ends before it starts
  synth.schedule({Bus::Melody, 0.0f, 0, 24000});        // no pitch
  const auto out = renderAll(synth, 24000);
  check(peak(out) == 0.0f, "a malformed note is dropped, not sounded");
  synth.render(nullptr, 128);  // must not crash
}

void scheduledOutOfOrder() {
  // Notes arrive as a melody is edited, not in time order.
  Synth synth;
  synth.configure(kRate);
  synth.schedule({Bus::Melody, 440.0f, 24000, 36000});
  synth.schedule({Bus::Melody, 330.0f, 0, 12000});
  std::vector<float> first(12000, 0.0f);
  for (std::size_t i = 0; i < first.size(); i += 256) {
    synth.render(first.data() + i, std::min<std::size_t>(256, first.size() - i));
  }
  check(peak(first) > 0.05f, "the earlier note sounds even though it came second");
}

}  // namespace

int main() {
  soundsWhatWasScheduled();
  silentBeforeAndAfter();
  oneClockForEveryBus();
  levelMovesWhatIsAlreadySounding();
  silenceIsSilent();
  longTakeCostsNoMoreThanShort();
  overlappingNotesBeyondThePoolDoNotBreak();
  startsAndStopsWithoutClicking();
  clearingABusLeavesOthersSounding();
  reconfiguringResets();
  nonsenseIsIgnored();
  scheduledOutOfOrder();

  if (failures > 0) {
    std::printf("%d check(s) failed\n", failures);
    return 1;
  }
  std::printf("SYNTH OK\n");
  return 0;
}
