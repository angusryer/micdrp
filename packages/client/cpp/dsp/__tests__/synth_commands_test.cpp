// synth_commands_test.cpp — host test for the ms/bus translation.
//
//   c++ -std=c++17 -O2 -I. synth.cpp synth_mailbox.cpp synth_commands.cpp \
//       __tests__/synth_commands_test.cpp -o t && ./t

#include "synth_commands.h"

#include <cstdio>
#include <vector>

using micdrp::Bus;
using micdrp::Synth;
using micdrp::SynthMailbox;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

void testBusFromIndex() {
  check(micdrp::busFromIndex(0) == Bus::Take, "0 is Take");
  check(micdrp::busFromIndex(3) == Bus::Audition, "3 is Audition");
  check(micdrp::busFromIndex(4) == Bus::Bass, "4 is Bass");
  // The click and the drums have their own, so neither shares a level with
  // the melody the way the click used to (INV-NOTES-119, INV-NOTES-120).
  check(micdrp::busFromIndex(5) == Bus::Click, "5 is Click");
  check(micdrp::busFromIndex(6) == Bus::Rhythm, "6 is Rhythm");
  // Out of range reads as Melody rather than indexing past the levels array.
  // Bus::Count is the sentinel and is itself out of range.
  check(micdrp::busFromIndex(static_cast<int>(Bus::Count)) == Bus::Melody,
        "the sentinel falls back to Melody");
  check(micdrp::busFromIndex(-1) == Bus::Melody, "-1 falls back to Melody");
  check(micdrp::busFromIndex(1.9) == Bus::Melody, "1.9 truncates to Melody");
}

// Rounded, not truncated: truncation places every note fractionally early,
// which over a long take reads as drift.
void testSamplesFromMs() {
  check(micdrp::samplesFromMs(1000, 48000) == 48000, "1s is a second of samples");
  check(micdrp::samplesFromMs(0, 48000) == 0, "zero is zero");
  // 0.5 sample: rounds up rather than down to 24.
  check(micdrp::samplesFromMs(0.51, 48000) == 24, "rounds to nearest");
  check(micdrp::samplesFromMs(100, 0) == 4800, "a bad rate falls back to 48k");
}

// The whole path: a posted note reaches the synth and sounds at the sample it
// was asked for.
void testPostedNoteSoundsWhenAsked() {
  Synth synth;
  synth.configure(48000);
  SynthMailbox box;

  // 10ms in, for 100ms, on Melody.
  check(micdrp::postSchedule(box, 1, 440.0, 10.0, 110.0, 48000), "accepted");
  check(box.drain(synth) == 1, "delivered");

  std::vector<float> out(480);   // exactly 10ms
  synth.render(out.data(), out.size());
  check(synth.activeVoices() == 0, "silent before its moment");

  synth.render(out.data(), out.size());
  check(synth.activeVoices() == 1, "sounding once its moment comes");
}

void testLevelAndClears() {
  Synth synth;
  synth.configure(48000);
  SynthMailbox box;

  micdrp::postBusLevel(box, 2, 0.25);
  box.drain(synth);
  check(synth.busLevel(Bus::Chords) == 0.25f, "level reaches its bus");

  micdrp::postSchedule(box, 2, 220.0, 0.0, 100.0, 48000);
  micdrp::postClearBus(box, 2);
  box.drain(synth);
  std::vector<float> out(64);
  synth.render(out.data(), out.size());
  check(synth.activeVoices() == 0, "a cleared bus sounds nothing");

  check(micdrp::postClearAll(box), "clearAll accepted");
}

}  // namespace

int main() {
  testBusFromIndex();
  testSamplesFromMs();
  testPostedNoteSoundsWhenAsked();
  testLevelAndClears();

  if (failures == 0) {
    std::printf("COMMANDS OK\n");
    return 0;
  }
  std::printf("%d failure(s)\n", failures);
  return 1;
}
