// ring_buffer.cpp — see ring_buffer.h.
//
// Classic SPSC ring with acquire/release ordering: the producer publishes new
// data with a release store to head_; the consumer observes it with an acquire
// load, and vice-versa for tail_. This guarantees the sample writes are visible
// before the index advance without a mutex.

#include "ring_buffer.h"

#include <algorithm>

namespace micdrp::dsp {

RingBuffer::RingBuffer(std::size_t capacity)
    : buffer_(capacity < 2 ? 2 : capacity, 0.0f) {}

std::size_t RingBuffer::write(const float* data, std::size_t count) {
  if (data == nullptr || count == 0) {
    return 0;
  }
  const std::size_t cap = buffer_.size();
  const std::size_t head = head_.load(std::memory_order_relaxed);
  const std::size_t tail = tail_.load(std::memory_order_acquire);

  // Free slots = cap - 1 - occupied.
  const std::size_t occupied = (head + cap - tail) % cap;
  const std::size_t free = (cap - 1) - occupied;
  const std::size_t toWrite = std::min(count, free);

  std::size_t h = head;
  for (std::size_t i = 0; i < toWrite; ++i) {
    buffer_[h] = data[i];
    h = (h + 1) % cap;
  }
  head_.store(h, std::memory_order_release);
  return toWrite;
}

std::size_t RingBuffer::read(float* out, std::size_t count) {
  if (out == nullptr || count == 0) {
    return 0;
  }
  const std::size_t cap = buffer_.size();
  const std::size_t tail = tail_.load(std::memory_order_relaxed);
  const std::size_t head = head_.load(std::memory_order_acquire);

  const std::size_t occupied = (head + cap - tail) % cap;
  const std::size_t toRead = std::min(count, occupied);

  std::size_t t = tail;
  for (std::size_t i = 0; i < toRead; ++i) {
    out[i] = buffer_[t];
    t = (t + 1) % cap;
  }
  tail_.store(t, std::memory_order_release);
  return toRead;
}

std::size_t RingBuffer::availableToRead() const {
  const std::size_t cap = buffer_.size();
  const std::size_t tail = tail_.load(std::memory_order_relaxed);
  const std::size_t head = head_.load(std::memory_order_acquire);
  return (head + cap - tail) % cap;
}

std::size_t RingBuffer::availableToWrite() const {
  return capacity() - availableToRead();
}

void RingBuffer::clear() {
  head_.store(0, std::memory_order_relaxed);
  tail_.store(0, std::memory_order_relaxed);
}

}  // namespace micdrp::dsp
