// ring_buffer.h — lock-free single-producer / single-consumer float ring.
//
// One audio-capture thread (producer) writes PCM frames via write(); one
// analysis consumer drains them via read()/availableToRead(). No locks, no
// allocation after construction — safe to call write() from the real-time
// audio callback. STL-only (std::atomic).
//
// Invariants:
//   * Exactly one producer thread and one consumer thread (SPSC). Multiple
//     producers or consumers are undefined.
//   * Capacity is fixed at construction. The usable capacity is capacity-1
//     (one slot is reserved to disambiguate full vs empty).

#ifndef MICDRP_DSP_RING_BUFFER_H
#define MICDRP_DSP_RING_BUFFER_H

#include <atomic>
#include <cstddef>
#include <vector>

namespace micdrp::dsp {

class RingBuffer {
 public:
  // `capacity` is the number of float slots to allocate; usable capacity is
  // capacity - 1. A capacity < 2 is clamped to 2.
  explicit RingBuffer(std::size_t capacity);

  // Producer side. Copies up to `count` samples in; returns the number
  // actually written (< count when the buffer fills). Never blocks/allocates.
  std::size_t write(const float* data, std::size_t count);

  // Consumer side. Copies up to `count` samples out; returns the number
  // actually read (< count when the buffer drains). Never blocks/allocates.
  std::size_t read(float* out, std::size_t count);

  // Consumer-side count of samples currently available to read.
  std::size_t availableToRead() const;

  // Producer-side count of free slots available to write.
  std::size_t availableToWrite() const;

  // Total usable capacity (capacity - 1).
  std::size_t capacity() const { return buffer_.size() - 1; }

  // Consumer-side reset. NOT thread-safe against a live producer; call only
  // when capture is stopped.
  void clear();

 private:
  std::vector<float> buffer_;
  std::atomic<std::size_t> head_{0};  // next write index (producer owns)
  std::atomic<std::size_t> tail_{0};  // next read index (consumer owns)
};

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_RING_BUFFER_H
