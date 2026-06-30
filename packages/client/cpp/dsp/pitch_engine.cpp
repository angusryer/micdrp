// pitch_engine.cpp — see pitch_engine.h.
//
// Overlap handling: MPM analyses frameSize windows that advance by hopSize
// (default 2048 / 1024 = 50% overlap). A plain SPSC ring consumes what it
// reads, so we keep a persistent `window_` of frameSize samples and slide it:
//   - prime: read frameSize samples to fill the first window;
//   - thereafter: shift left by hopSize and read hopSize fresh samples into the
//     tail, so each analysis sees a window overlapping the previous by
//     frameSize - hopSize.
// This keeps the algorithm identical to feeding logic/detectPitch a frameSize
// slice every hop, while draining the ring exactly hopSize per emitted sample.

#include "pitch_engine.h"

#include <algorithm>

#include "notes.h"

namespace micdrp::dsp {

void PitchEngine::configure(const EngineConfig& config) {
  EngineConfig cfg = config;
  if (cfg.frameSize < 4) {
    cfg.frameSize = 4;
  }
  if (cfg.hopSize == 0 || cfg.hopSize > cfg.frameSize) {
    cfg.hopSize = cfg.frameSize;  // no overlap if hop is invalid
  }
  mpm_.configure(cfg);

  window_.assign(cfg.frameSize, 0.0f);
  // Ring holds several windows so a brief consumer stall never drops audio.
  ring_ = std::make_unique<RingBuffer>(cfg.frameSize * 4 + 1);
  analyzedSamples_ = 0;
  primed_ = false;
}

std::size_t PitchEngine::push(const float* samples, std::size_t count) {
  if (ring_ == nullptr || samples == nullptr) {
    return 0;
  }
  return ring_->write(samples, count);
}

std::optional<PitchSample> PitchEngine::tryAnalyze() {
  if (ring_ == nullptr) {
    return std::nullopt;
  }
  const EngineConfig& cfg = mpm_.config();
  const std::size_t frameSize = cfg.frameSize;
  const std::size_t hopSize = cfg.hopSize;

  if (!primed_) {
    // Need a full frame before the first analysis.
    if (ring_->availableToRead() < frameSize) {
      return std::nullopt;
    }
    const std::size_t got = ring_->read(window_.data(), frameSize);
    if (got < frameSize) {
      return std::nullopt;  // racy underfill; try again next pump
    }
    primed_ = true;
    // The window's leading edge sits at analyzedSamples_ == 0.
  } else {
    // Need one hop of fresh audio to advance the sliding window.
    if (ring_->availableToRead() < hopSize) {
      return std::nullopt;
    }
    // Slide left by hopSize, keeping the overlap (frameSize - hopSize).
    const std::size_t keep = frameSize - hopSize;
    std::copy(window_.begin() + static_cast<std::ptrdiff_t>(hopSize),
              window_.end(), window_.begin());
    const std::size_t got =
        ring_->read(window_.data() + keep, hopSize);
    if (got < hopSize) {
      return std::nullopt;  // racy underfill
    }
    analyzedSamples_ += hopSize;
  }

  const PitchResult r = mpm_.detect(window_.data(), frameSize);

  PitchSample sample;
  // Timestamp at the window's leading edge, matching how the offline pipeline
  // timestamps hop-spaced frames.
  sample.timestampMs =
      cfg.sampleRateHz > 0.0
          ? (static_cast<double>(analyzedSamples_) * 1000.0) / cfg.sampleRateHz
          : 0.0;
  sample.clarity = r.clarity;

  if (r.voiced && r.frequencyHz > 0.0) {
    const NoteReading note = frequencyToNote(r.frequencyHz);
    sample.frequencyHz = r.frequencyHz;
    sample.midi = note.midi;
    sample.cents = note.cents;
    sample.voiced = true;
  } else {
    sample.frequencyHz = 0.0;
    sample.voiced = false;  // midi/cents -> null on the wire
  }
  return sample;
}

void PitchEngine::reset() {
  if (ring_ != nullptr) {
    ring_->clear();
  }
  std::fill(window_.begin(), window_.end(), 0.0f);
  analyzedSamples_ = 0;
  primed_ = false;
}

}  // namespace micdrp::dsp
