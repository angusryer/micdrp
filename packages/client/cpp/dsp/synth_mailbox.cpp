// synth_mailbox.cpp — see synth_mailbox.h.

#include "synth_mailbox.h"

namespace micdrp {

bool SynthMailbox::post(const SynthCommand& command) {
  const std::size_t head = head_.load(std::memory_order_relaxed);
  const std::size_t next = (head + 1) % kSlots;
  if (next == tail_.load(std::memory_order_acquire)) {
    return false;  // full — one slot stays open to tell full from empty
  }
  slots_[head] = command;
  head_.store(next, std::memory_order_release);
  return true;
}

std::size_t SynthMailbox::drain(Synth& synth) {
  std::size_t tail = tail_.load(std::memory_order_relaxed);
  const std::size_t head = head_.load(std::memory_order_acquire);
  std::size_t applied = 0;

  while (tail != head) {
    const SynthCommand& c = slots_[tail];
    switch (c.kind) {
      case SynthCommand::Kind::Schedule:
        synth.schedule(c.note);
        break;
      case SynthCommand::Kind::SetBusLevel:
        synth.setBusLevel(c.bus, c.level);
        break;
      case SynthCommand::Kind::ClearBus:
        synth.clearBus(c.bus);
        break;
      case SynthCommand::Kind::SetBusWave:
        synth.setBusWave(c.bus, c.wave);
        break;
      case SynthCommand::Kind::SetSample:
        synth.setSample(c.sampleSlot, c.sample);
        break;
      case SynthCommand::Kind::ClearAll:
        synth.clearAll();
        break;
    }
    tail = (tail + 1) % kSlots;
    ++applied;
  }

  tail_.store(tail, std::memory_order_release);
  return applied;
}

}  // namespace micdrp
