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

constexpr float kTwoPi = 6.283185307179586f;

int busIndex(Bus bus) {
  const int i = static_cast<int>(bus);
  return (i >= 0 && i < static_cast<int>(Bus::Count)) ? i : 0;
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
  }
}

void Synth::setBusLevel(Bus bus, float level) {
  busLevels_[busIndex(bus)] = std::min(1.0f, std::max(0.0f, level));
}

float Synth::busLevel(Bus bus) const { return busLevels_[busIndex(bus)]; }

void Synth::schedule(const ScheduledNote& note) {
  if (note.endSample <= note.startSample || note.frequencyHz <= 0.0f) {
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
      mix += std::sin(kTwoPi * v.phase) * v.envelope * kVoicePeak *
             busLevels_[busIndex(v.bus)];
      v.phase += v.phaseStep;
      if (v.phase >= 1.0f) {
        v.phase -= 1.0f;
      }
    }

    out[i] = std::max(-1.0f, std::min(1.0f, mix));
  }

  now_ = blockEnd;

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
