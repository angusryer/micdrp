// synth.cpp — see synth.h.

#include "synth.h"

#include <algorithm>
#include <cmath>

namespace micdrp {
namespace {

/// Ramp length for attack and release, in seconds.
///
/// Short enough to feel immediate, long enough that a voice starting or
/// stopping does not click. A click is a step change in amplitude, and at
/// these levels the ear hears it as a tick against the take.
constexpr float kRampSeconds = 0.006f;

/// Peak amplitude of one voice before its bus level is applied.
///
/// Well under full scale: several voices sound at once and the sum must not
/// clip. A chord is three or four of these, and a chord under a melody is
/// more.
constexpr float kVoicePeak = 0.18f;

/// Peak amplitude of a recorded voice.
///
/// Unity, unlike a tone: a take was recorded at whatever level it was sung at
/// and the engine's job is to reproduce it, not to attenuate it. Balancing it
/// against the tones is what its bus level is for (INV-NOTES-133).
constexpr float kSamplePeak = 1.0f;

int busIndex(Bus bus) {
  const int i = static_cast<int>(bus);
  return (i >= 0 && i < kMaxBuses) ? i : 0;
}

}  // namespace

Synth::Synth() { pending_.reserve(256); }

void Synth::configure(double sampleRateHz) {
  sampleRate_ = sampleRateHz > 0.0 ? sampleRateHz : 48000.0;
  now_ = 0;
  // Positions from a different rate describe different moments, so nothing
  // scheduled under the old one survives. Voices are cut rather than released:
  // a rate change means their phase step describes the wrong pitch, and there
  // is no continuity left to preserve.
  pending_.clear();
  nextPending_ = 0;
  for (Voice& v : voices_) {
    v.active = false;
    v.releasing = false;
    v.envelope = 0.0f;
    v.source = nullptr;
  }
  // Frames at the old rate describe a different duration, so a slot loaded
  // for one rate is not audio for another.
  for (SampleData& data : samples_) {
    data = SampleData{};
  }
}

void Synth::setBusWave(Bus bus, Wave wave) {
  busWaves_[busIndex(bus)] = wave;
}

Wave Synth::busWave(Bus bus) const { return busWaves_[busIndex(bus)]; }

void Synth::setBusLevel(Bus bus, float level) {
  busLevels_[busIndex(bus)] = std::min(1.0f, std::max(0.0f, level));
}

float Synth::busLevel(Bus bus) const { return busLevels_[busIndex(bus)]; }

void Synth::setSample(int slot, SampleData data) {
  if (slot < 0 || slot >= kMaxSamples) {
    return;
  }
  // Frames without a count, or a count without frames, is a slot that would
  // read past the end of nothing.
  samples_[slot] = (data.frames != nullptr && data.frameCount > 0)
                       ? data
                       : SampleData{};
}

SampleData Synth::sample(int slot) const {
  return (slot >= 0 && slot < kMaxSamples) ? samples_[slot] : SampleData{};
}

void Synth::schedule(const ScheduledNote& note) {
  const bool isSample = note.sampleSlot >= 0 && note.sampleSlot < kMaxSamples;
  if (note.endSample <= note.startSample) {
    return;
  }
  // A tone needs a pitch and a sample needs a slot; neither is a sound.
  if (!isSample && note.frequencyHz <= 0.0f) {
    return;
  }
  // Kept sorted so admission is a walk from the front rather than a scan of
  // everything on every block.
  const auto at = std::upper_bound(
      pending_.begin() + static_cast<std::ptrdiff_t>(nextPending_),
      pending_.end(), note,
      [](const ScheduledNote& a, const ScheduledNote& b) {
        return a.startSample < b.startSample;
      });
  pending_.insert(at, note);
}

void Synth::clearBus(Bus bus) {
  pending_.erase(
      std::remove_if(pending_.begin() + static_cast<std::ptrdiff_t>(nextPending_),
                     pending_.end(),
                     [bus](const ScheduledNote& n) { return n.bus == bus; }),
      pending_.end());
  // Released rather than cut: stopping should not click either.
  for (Voice& v : voices_) {
    if (v.active && v.bus == bus) {
      v.releasing = true;
    }
  }
}

void Synth::startTransport(std::int64_t startSample, std::int64_t offsetSamples,
                           std::int64_t endSample) {
  // Replaces whatever was running. Two runs at once is not a thing a
  // transport can mean, and joining them would be inventing one.
  runStart_ = startSample;
  runOffset_ = offsetSamples;
  runEnd_ = endSample;
  runPosition_ = offsetSamples;
  runRunning_ = true;
  runGeneration_ += 1;
  publishRun();
}

void Synth::stopTransport() {
  runRunning_ = false;
  publishRun();
}

void Synth::publishRun() {
  // Odd while writing, even when settled. A reader that sees an odd
  // count, or a different one either side of its read, tries again.
  const std::uint32_t begin = reportSeq_.load(std::memory_order_relaxed);
  reportSeq_.store(begin + 1, std::memory_order_release);
  std::atomic_thread_fence(std::memory_order_release);
  reportSeq_.store(begin + 2, std::memory_order_release);
}

TransportReport Synth::report() const {
  TransportReport out;
  for (;;) {
    const std::uint32_t before = reportSeq_.load(std::memory_order_acquire);
    if (before % 2 != 0) {
      continue;  // a write is in flight
    }
    out.positionSamples = runPosition_;
    out.running = runRunning_;
    out.generation = runGeneration_;
    out.ended = runEnded_;
    std::atomic_thread_fence(std::memory_order_acquire);
    if (reportSeq_.load(std::memory_order_relaxed) == before) {
      return out;
    }
  }
}

void Synth::clearAll() {
  pending_.clear();
  nextPending_ = 0;
  for (Voice& v : voices_) {
    if (v.active) {
      v.releasing = true;
    }
  }
}

Synth::Voice* Synth::freeVoice() {
  for (Voice& v : voices_) {
    if (!v.active) {
      return &v;
    }
  }
  // Every voice busy: take the one nearest its end, which is the one whose
  // loss is least audible.
  Voice* oldest = &voices_[0];
  for (Voice& v : voices_) {
    if (v.endSample < oldest->endSample) {
      oldest = &v;
    }
  }
  return oldest;
}

void Synth::admit(std::int64_t blockStart, std::int64_t blockEnd) {
  while (nextPending_ < pending_.size() &&
         pending_[nextPending_].startSample < blockEnd) {
    const ScheduledNote& note = pending_[nextPending_];
    // Already finished before anyone listened: nothing to sound.
    if (note.endSample <= blockStart) {
      ++nextPending_;
      continue;
    }
    Voice* v = freeVoice();
    v->active = true;
    v->releasing = false;
    v->bus = note.bus;
    v->phase = 0.0f;
    v->phaseStep = static_cast<float>(note.frequencyHz / sampleRate_);
    v->startSample = note.startSample;
    v->endSample = note.endSample;
    v->envelope = 0.0f;
    // Bound once, here. A voice reads the audio its slot held when it began,
    // whatever the slot holds later (INV-NOTES-133).
    v->isSample = note.sampleSlot >= 0;
    v->wave = busWaves_[busIndex(note.bus)];
    const SampleData resident = sample(note.sampleSlot);
    v->source = resident.frames;
    v->sourceCount = resident.frameCount;
    v->sourcePos = note.sourceFrame > 0 ? note.sourceFrame : 0;
    ++nextPending_;
  }
}

void Synth::render(float* out, std::size_t frames) {
  if (out == nullptr || frames == 0) {
    return;
  }
  const std::int64_t blockStart = now_;
  const std::int64_t blockEnd = now_ + static_cast<std::int64_t>(frames);
  admit(blockStart, blockEnd);

  const float rampStep = 1.0f / std::max(1.0f, kRampSeconds * static_cast<float>(sampleRate_));

  for (std::size_t i = 0; i < frames; ++i) {
    const std::int64_t sample = blockStart + static_cast<std::int64_t>(i);
    float mix = 0.0f;

    for (Voice& v : voices_) {
      if (!v.active || sample < v.startSample) {
        continue;
      }
      const bool ending = v.releasing || sample >= v.endSample;
      v.envelope = ending ? std::max(0.0f, v.envelope - rampStep)
                          : std::min(1.0f, v.envelope + rampStep);
      if (ending && v.envelope <= 0.0f) {
        v.active = false;
        continue;
      }
      const float level = v.envelope * busLevels_[busIndex(v.bus)];
      if (v.isSample) {
        // Past its own end is silence rather than a wrap: a take that ran out
        // has nothing more to say, and looping it would say something else.
        if (v.source != nullptr &&
            v.sourcePos < static_cast<std::int64_t>(v.sourceCount)) {
          mix += v.source[v.sourcePos] * level * kSamplePeak;
        }
        ++v.sourcePos;
        continue;
      }
      mix += waveSample(v.wave, v.phase, v.phaseStep, noiseState_) * level *
             kVoicePeak;
      v.phase += v.phaseStep;
      if (v.phase >= 1.0f) {
        v.phase -= 1.0f;
      }
    }

    out[i] = std::max(-1.0f, std::min(1.0f, mix));
  }

  now_ = blockEnd;

  // Where the run reached, worked out from the engine's own clock rather
  // than from a wall clock anywhere else (INV-TPORT-010). A run that has
  // passed its end says so itself, so nothing has to predict it
  // (INV-TPORT-011).
  if (runRunning_) {
    runPosition_ = runOffset_ + (blockEnd - runStart_);
    if (blockEnd >= runEnd_) {
      runPosition_ = runOffset_ + (runEnd_ - runStart_);
      runRunning_ = false;
      runEnded_ += 1;
    }
    publishRun();
  }

  // Notes fully consumed are dropped in one go rather than erased one at a
  // time, so scheduling stays cheap over a long session.
  if (nextPending_ > 128) {
    pending_.erase(pending_.begin(),
                   pending_.begin() + static_cast<std::ptrdiff_t>(nextPending_));
    nextPending_ = 0;
  }
}

std::size_t Synth::activeVoices() const {
  std::size_t n = 0;
  for (const Voice& v : voices_) {
    if (v.active) {
      ++n;
    }
  }
  return n;
}

}  // namespace micdrp
