// pitch_engine.h — the Tier-1 hot path: ring buffer + MPM, producing
// PitchSample frames identical in shape to src/audio/contract.ts PitchSample.
//
// Usage (native bridge, WP-AUDIO-BRIDGE):
//   PitchEngine engine;
//   engine.configure(cfg);          // off the audio thread
//   // audio callback (real-time thread):
//   engine.push(frame, frameCount); // lock-free enqueue, no allocation
//   // analysis pump (consumer thread / drained from the bridge):
//   while (auto s = engine.tryAnalyze()) { emitThrottled(*s); }
//
// PCM never crosses into JS: only PitchSample does. push() is real-time safe;
// tryAnalyze() runs on a worker/consumer thread and does the MPM + note math.

#ifndef MICDRP_DSP_PITCH_ENGINE_H
#define MICDRP_DSP_PITCH_ENGINE_H

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

#include "mpm.h"
#include "ring_buffer.h"

namespace micdrp::dsp {

// Mirrors src/audio/contract.ts PitchSample exactly. midi/cents use a `voiced`
// flag instead of TS `null`; the bridge maps !voiced -> {midi: null, cents:
// null, frequencyHz: 0} when marshalling to JS.
struct PitchSample {
  double timestampMs = 0.0;   // ms from capture start
  double frequencyHz = 0.0;   // 0 when unvoiced
  double clarity = 0.0;       // 0..1 NSDF peak
  int midi = 0;               // nearest MIDI note (valid iff voiced)
  int cents = 0;              // -50..50 deviation (valid iff voiced)
  bool voiced = false;        // false -> midi/cents are null on the wire
};

class PitchEngine {
 public:
  PitchEngine() = default;

  // Configure the detector and (re)size the ring buffer. Call off the audio
  // thread before capture starts. Resets the sample clock and ring buffer.
  // The ring is sized to hold several analysis windows so a brief consumer
  // stall does not drop audio.
  void configure(const EngineConfig& config);

  const EngineConfig& config() const { return mpm_.config(); }

  // Real-time safe. Enqueue `count` PCM samples from the audio callback.
  // Returns the number accepted (< count only if the ring overflows, which
  // means the consumer is not draining fast enough). Never allocates/blocks.
  std::size_t push(const float* samples, std::size_t count);

  // Consumer side. If at least one full hop has accumulated, run MPM over the
  // next frameSize window, advance by hopSize, and return the PitchSample.
  // Returns std::nullopt when there is not yet a full frame to analyze.
  std::optional<PitchSample> tryAnalyze();

  // Consumer-side reset (capture stopped). Not safe against a live producer.
  void reset();

  // Total samples consumed by analysis so far (drives timestampMs).
  std::uint64_t analyzedSamples() const { return analyzedSamples_; }

 private:
  Mpm mpm_{};
  std::unique_ptr<RingBuffer> ring_{};
  std::vector<float> window_{};        // reusable frameSize analysis buffer
  std::uint64_t analyzedSamples_ = 0;  // hop-advanced sample counter
  bool primed_ = false;                // first full window read yet?
};

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_PITCH_ENGINE_H
