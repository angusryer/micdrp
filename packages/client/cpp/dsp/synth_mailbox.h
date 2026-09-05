// synth_mailbox.h — lock-free SPSC command ring between a control thread and
// the audio thread that owns a Synth.
//
// Synth is single-threaded by design: schedule() inserts into the same vector
// render() walks. The platform layer calls from two threads — JS posts notes
// and levels, the render callback produces samples — so commands cross here
// and the Synth itself is only ever touched by the audio thread, which drains
// the mailbox at the top of each render block. That is what lets render()
// keep its "no locks" promise (INV-NOTES-028).
//
// Same discipline as ring_buffer.h: exactly one producer thread and one
// consumer thread; capacity fixed at construction time; post() never blocks
// or allocates, drain() never blocks or allocates.

#ifndef MICDRP_DSP_SYNTH_MAILBOX_H
#define MICDRP_DSP_SYNTH_MAILBOX_H

#include <array>
#include <atomic>
#include <cstddef>

#include "synth.h"

namespace micdrp {

/// One instruction for the audio thread to apply to its Synth.
struct SynthCommand {
  enum class Kind : int {
    Schedule,
    SetBusLevel,
    ClearBus,
    ClearAll,
    SetSample,
    SetBusWave,
    /// A run beginning or ending. Time passing, not a sound
    /// (INV-TPORT-013).
    StartTransport,
    StopTransport
  };
  Kind kind = Kind::ClearAll;
  Bus bus = Bus::Melody;      ///< SetBusLevel / ClearBus
  float level = 0.0f;         ///< SetBusLevel
  ScheduledNote note;         ///< Schedule
  Wave wave = Wave::Sine;     ///< SetBusWave
  int sampleSlot = -1;        ///< SetSample
  SampleData sample;          ///< SetSample
};

class SynthMailbox {
 public:
  /// Producer side. Returns false when the ring is full — the command is NOT
  /// applied, and the caller decides whether that is worth reporting. Never
  /// blocks, never allocates.
  bool post(const SynthCommand& command);

  /// Consumer side (audio thread). Applies every pending command to `synth`
  /// in the order posted; returns how many were applied. Never blocks, never
  /// allocates. Note that Synth::schedule may grow its own pending vector —
  /// it reserves 256 up front, so this stays allocation-free in practice
  /// until a very long schedule outgrows that.
  std::size_t drain(Synth& synth);

  /// Usable capacity (one slot is reserved to tell full from empty).
  static constexpr std::size_t capacity() { return kSlots - 1; }

 private:
  /// Room for a whole take scheduled in one go — melody plus chords of a
  /// long idea is hundreds of notes, not thousands.
  static constexpr std::size_t kSlots = 4096;

  std::array<SynthCommand, kSlots> slots_;
  std::atomic<std::size_t> head_{0};  ///< next write index (producer owns)
  std::atomic<std::size_t> tail_{0};  ///< next read index (consumer owns)
};

}  // namespace micdrp

#endif  // MICDRP_DSP_SYNTH_MAILBOX_H
