// sample_stream.h — a take read from disk, one frame at a time, without the
// audio thread ever touching a file (INV-TPORT-028).
//
// A take short enough to hold is held; a long one is streamed through this.
// A reader thread fills a window ahead of the playhead and the audio thread
// reads only what is already there — never blocking, never allocating, and
// never faulting a page. Memory-mapping the file instead reads as the simple
// answer and is the one shape that cannot be made real-time safe: a page
// fault inside the render callback is an unbounded stall, which is exactly
// what the lock-free command ring exists to avoid.
//
// Single-producer, single-consumer, same discipline as synth_mailbox.h. The
// audio thread writes `readPos_`, `startPos_` and `generation_` and nothing
// else; the reader thread writes `filled_` and nothing else. Positions are
// absolute frames of the recording, so a locate is a number rather than a
// negotiation.

#ifndef MICDRP_DSP_SAMPLE_STREAM_H
#define MICDRP_DSP_SAMPLE_STREAM_H

#include <atomic>
#include <cstddef>
#include <cstdint>

namespace micdrp {

/**
 * A window onto a recording, filled from behind and read from in front.
 *
 * The buffer is not owned here, for the same reason `SampleData` does not own
 * its frames: whoever allocated it must outlive every voice that may still be
 * inside it.
 */
class SampleStream {
 public:
  /// Point the window at a buffer. Control thread, before anything sounds.
  void attach(std::int16_t* buffer, std::size_t capacity,
              std::int64_t frameCount) {
    data_ = buffer;
    capacity_ = capacity;
    frameCount_ = frameCount;
    startPos_.store(0, std::memory_order_relaxed);
    readPos_.store(0, std::memory_order_relaxed);
    filled_.store(0, std::memory_order_release);
    generation_.store(0, std::memory_order_release);
    underruns_.store(0, std::memory_order_relaxed);
  }

  bool attached() const { return data_ != nullptr; }
  std::int64_t frameCount() const { return frameCount_; }

  // ---- audio thread ----

  /**
   * Say where reading is about to begin, because a voice was admitted.
   *
   * The reader notices the generation change and refills from there. Called
   * on the audio thread, so it stores and returns.
   */
  void beginAt(std::int64_t frame) {
    startPos_.store(frame, std::memory_order_relaxed);
    readPos_.store(frame, std::memory_order_relaxed);
    generation_.fetch_add(1, std::memory_order_release);
  }

  /**
   * The frame at `pos`, if the reader has got there yet.
   *
   * False means the window has not been filled this far — silence for this
   * frame, counted, and on to the next. Never waits.
   */
  bool read(std::int64_t pos, std::int16_t& out) {
    if (pos < 0 || pos >= frameCount_) {
      // Past the end of the recording is silence, not a reader that fell
      // behind. Counting it would make every completed playback look failed.
      readPos_.store(pos, std::memory_order_release);
      return false;
    }
    const std::int64_t filled = filled_.load(std::memory_order_acquire);
    if (pos >= filled || filled - pos > static_cast<std::int64_t>(capacity_)) {
      readPos_.store(pos, std::memory_order_release);
      underruns_.fetch_add(1, std::memory_order_relaxed);
      return false;
    }
    out = data_[static_cast<std::size_t>(pos % static_cast<std::int64_t>(capacity_))];
    // Published after the copy, and as the next frame wanted rather than the
    // last one taken: this is the reader's permission to reuse the slot, so
    // giving it before reading would let the frame be overwritten mid-read.
    readPos_.store(pos + 1, std::memory_order_release);
    return true;
  }

  std::int64_t underruns() const {
    return underruns_.load(std::memory_order_relaxed);
  }

  // ---- reader thread ----

  /// Which locate this is, so a jump is noticed rather than polled for.
  std::uint64_t generation() const {
    return generation_.load(std::memory_order_acquire);
  }

  /// Where the audio thread said reading would begin.
  std::int64_t startPos() const {
    return startPos_.load(std::memory_order_relaxed);
  }

  /// Throw the window away and refill from `frame`. Reader thread only.
  void rewindTo(std::int64_t frame) {
    filled_.store(frame, std::memory_order_release);
  }

  /// The next frame the reader should supply.
  std::int64_t wantFrom() const {
    return filled_.load(std::memory_order_relaxed);
  }

  /// How many frames may be supplied right now without overwriting audio
  /// nobody has read. Zero means the window is full and the reader waits.
  std::size_t room() const {
    const std::int64_t ahead =
        filled_.load(std::memory_order_relaxed) -
        readPos_.load(std::memory_order_acquire);
    const std::int64_t free = static_cast<std::int64_t>(capacity_) - ahead;
    return free <= 0 ? 0 : static_cast<std::size_t>(free);
  }

  /**
   * Hand over frames read from the file, starting at `wantFrom()`.
   *
   * Copies at most `room()`; returns how many were taken so the reader can
   * advance its own file position by exactly that.
   */
  std::size_t supply(const std::int16_t* frames, std::size_t count) {
    const std::size_t take = count < room() ? count : room();
    std::int64_t at = filled_.load(std::memory_order_relaxed);
    for (std::size_t i = 0; i < take; ++i, ++at) {
      data_[static_cast<std::size_t>(at % static_cast<std::int64_t>(capacity_))] =
          frames[i];
    }
    filled_.store(at, std::memory_order_release);
    return take;
  }

 private:
  std::int16_t* data_ = nullptr;
  std::size_t capacity_ = 0;
  std::int64_t frameCount_ = 0;
  std::atomic<std::int64_t> startPos_{0};
  std::atomic<std::int64_t> readPos_{0};
  std::atomic<std::int64_t> filled_{0};
  std::atomic<std::uint64_t> generation_{0};
  std::atomic<std::int64_t> underruns_{0};
};

}  // namespace micdrp

#endif  // MICDRP_DSP_SAMPLE_STREAM_H
