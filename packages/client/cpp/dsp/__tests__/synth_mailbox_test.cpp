// synth_mailbox_test.cpp — host test for the command ring (INV-NOTES-028).
//
//   cd packages/client/cpp/dsp
//   cmake -S . -B build && cmake --build build && ./build/dsp_mailbox_test
//
// Or without CMake:
//   c++ -std=c++17 -O2 -I. synth.cpp synth_mailbox.cpp \
//       __tests__/synth_mailbox_test.cpp -o t && ./t

#include "synth_mailbox.h"

#include <cstdio>
#include <thread>
#include <vector>

using micdrp::Bus;
using micdrp::ScheduledNote;
using micdrp::Synth;
using micdrp::SynthCommand;
using micdrp::SynthMailbox;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

SynthCommand scheduleCmd(Bus bus, float hz, std::int64_t start, std::int64_t end) {
  SynthCommand c;
  c.kind = SynthCommand::Kind::Schedule;
  c.note = ScheduledNote{bus, hz, start, end};
  return c;
}

// Commands drain in the order posted, and reach the synth: a level posted
// after a schedule must land after it, so a play-then-duck sequence stays a
// play-then-duck.
void testOrderAndEffect() {
  Synth synth;
  synth.configure(48000);
  SynthMailbox box;

  check(box.post(scheduleCmd(Bus::Melody, 440.0f, 0, 4800)), "post schedule");
  SynthCommand level;
  level.kind = SynthCommand::Kind::SetBusLevel;
  level.bus = Bus::Melody;
  level.level = 0.25f;
  check(box.post(level), "post level");

  check(box.drain(synth) == 2, "drain applies both commands");
  check(synth.busLevel(Bus::Melody) == 0.25f, "level reached the synth");

  std::vector<float> out(512);
  synth.render(out.data(), out.size());
  check(synth.activeVoices() == 1, "scheduled note is sounding");
  check(box.drain(synth) == 0, "drained ring is empty");
}

// A full ring refuses the command rather than blocking or overwriting: the
// producer may be the JS thread, and the consumer the audio callback — losing
// the oldest silently would unschedule a note nobody chose to drop.
void testFullRingRefuses() {
  SynthMailbox box;
  std::size_t posted = 0;
  while (box.post(scheduleCmd(Bus::Chords, 220.0f, 0, 100))) {
    ++posted;
  }
  check(posted == SynthMailbox::capacity(), "fills to stated capacity");
  check(!box.post(scheduleCmd(Bus::Chords, 220.0f, 0, 100)), "full ring says no");

  Synth synth;
  synth.configure(48000);
  check(box.drain(synth) == posted, "everything accepted is delivered");
}

// One producer, one consumer, no locks: every command posted arrives exactly
// once. The consumer drains into a synth like the render callback does.
void testTwoThreads() {
  Synth synth;
  synth.configure(48000);
  SynthMailbox box;
  constexpr std::size_t kTotal = 20000;

  std::thread producer([&box] {
    std::size_t sent = 0;
    while (sent < kTotal) {
      if (box.post(scheduleCmd(Bus::Audition, 330.0f,
                               static_cast<std::int64_t>(sent) * 10,
                               static_cast<std::int64_t>(sent) * 10 + 5))) {
        ++sent;
      }  // full: spin until the consumer catches up
    }
  });

  std::size_t received = 0;
  while (received < kTotal) {
    received += box.drain(synth);
  }
  producer.join();

  check(received == kTotal, "every command arrives exactly once");
  check(box.drain(synth) == 0, "nothing left after the last drain");
}

}  // namespace

int main() {
  testOrderAndEffect();
  testFullRingRefuses();
  testTwoThreads();

  if (failures == 0) {
    std::printf("MAILBOX OK\n");
    return 0;
  }
  std::printf("%d failure(s)\n", failures);
  return 1;
}
