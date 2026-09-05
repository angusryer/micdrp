// sample_stream_test.cpp — the window a long take is read through.
//
// ACC-TPORT-022 / INV-TPORT-028. The property that matters is what happens
// when the reader is behind: the audio thread must get an answer, must not
// wait, and must say the frame was missing rather than hand back whatever
// was in the buffer. Everything else here exists to prove the ordinary case
// still delivers the recording exactly.
//
//   c++ -std=c++17 -O2 -I. __tests__/sample_stream_test.cpp -o t && ./t

#include "../sample_stream.h"

#include <cstdio>
#include <cstdlib>
#include <vector>

using micdrp::SampleStream;

namespace {

int failures = 0;

void check(bool ok, const char* what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what);
    ++failures;
  }
}

/// A recording whose frame n holds n, so a wrong frame names itself.
std::vector<std::int16_t> recording(std::size_t frames) {
  std::vector<std::int16_t> data(frames);
  for (std::size_t i = 0; i < frames; ++i) {
    data[i] = static_cast<std::int16_t>(i % 30000);
  }
  return data;
}

/// A stream over `frames` frames with a window of `capacity`.
struct Rig {
  std::vector<std::int16_t> file;
  std::vector<std::int16_t> window;
  SampleStream stream;

  Rig(std::size_t frames, std::size_t capacity)
      : file(recording(frames)), window(capacity, 0) {
    stream.attach(window.data(), capacity, static_cast<std::int64_t>(frames));
  }

  /// What the reader thread does: hand over whatever the window has room for.
  std::size_t fill() {
    std::size_t supplied = 0;
    while (stream.room() > 0) {
      const std::int64_t from = stream.wantFrom();
      if (from >= static_cast<std::int64_t>(file.size())) {
        break;
      }
      const std::size_t left = file.size() - static_cast<std::size_t>(from);
      const std::size_t took =
          stream.supply(file.data() + from, left < 512 ? left : 512);
      if (took == 0) {
        break;
      }
      supplied += took;
    }
    return supplied;
  }
};

void deliversTheRecordingExactly() {
  Rig rig(4000, 1024);
  rig.fill();
  std::int16_t frame = 0;
  bool everyFrameArrived = true;
  for (std::int64_t pos = 0; pos < 4000; ++pos) {
    if (!rig.stream.read(pos, frame) || frame != rig.file[static_cast<std::size_t>(pos)]) {
      everyFrameArrived = false;
      break;
    }
    // The reader keeps up, which is the ordinary case on any real device.
    rig.fill();
  }
  check(everyFrameArrived, "a stream delivers the recording frame for frame");
}

void aDrainedWindowReportsRatherThanBlocks() {
  Rig rig(100000, 1024);
  rig.fill();  // one window's worth, and nothing after it
  std::int16_t frame = 0;
  // Read straight through what was filled and out the other side.
  for (std::int64_t pos = 0; pos < 1024; ++pos) {
    rig.stream.read(pos, frame);
  }
  const bool got = rig.stream.read(1024, frame);
  check(!got, "a frame the reader has not reached is refused, not invented");
  check(rig.stream.underruns() == 1, "and the shortfall is counted");
}

void pastTheEndIsSilenceNotAFault() {
  Rig rig(500, 1024);
  rig.fill();
  std::int16_t frame = 0;
  const bool got = rig.stream.read(600, frame);
  check(!got, "past the end of the recording there is nothing to read");
  // A take that ran out is not a reader that fell behind, and counting it as
  // one would make every completed playback look like a failure.
  check(rig.stream.underruns() == 0, "running out is not an underrun");
}

void aLocateRefillsFromTheNewPlace() {
  Rig rig(100000, 1024);
  rig.fill();
  const std::uint64_t before = rig.stream.generation();

  // The audio thread admits a voice starting deep into the take.
  rig.stream.beginAt(50000);
  check(rig.stream.generation() != before, "a locate is noticed by the reader");
  check(rig.stream.startPos() == 50000, "and it says where to read from");

  // Which is what the reader thread acts on.
  rig.stream.rewindTo(rig.stream.startPos());
  rig.fill();

  std::int16_t frame = 0;
  check(rig.stream.read(50000, frame) && frame == rig.file[50000],
        "reading resumes at the moment that was located to");
}

void neverOverwritesWhatHasNotBeenRead() {
  Rig rig(100000, 1024);
  const std::size_t first = rig.fill();
  check(first == 1024, "the window fills to its capacity and stops");
  // Nothing consumed, so there is no room and the reader must wait.
  check(rig.stream.room() == 0, "a full window offers no room");
  check(rig.fill() == 0, "and takes nothing more until something is read");

  std::int16_t frame = 0;
  for (std::int64_t pos = 0; pos < 512; ++pos) {
    rig.stream.read(pos, frame);
  }
  check(rig.stream.room() == 512, "reading gives the room back");
}

}  // namespace

int main() {
  deliversTheRecordingExactly();
  aDrainedWindowReportsRatherThanBlocks();
  pastTheEndIsSilenceNotAFault();
  aLocateRefillsFromTheNewPlace();
  neverOverwritesWhatHasNotBeenRead();
  if (failures > 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("STREAM OK\n");
  return 0;
}
