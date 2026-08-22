// synth.h — one voice pool, one clock, for everything the app sounds.
//
// Three separate audio graphs cannot agree on a moment. Alignment used to go
// through an elapsed time measured in JS and handed between them, which is as
// accurate as a render and a context creation allow. One sample counter makes
// it exact (INV-NOTES-028).
//
// A fixed pool of voices, reused as notes finish, replaces a node per note: a
// minute-long take built hundreds of them before making a sound
// (INV-NOTES-029).
//
// Dependency-free and STL-only, like the rest of this core: it produces
// samples, and the platform layer does nothing but hand them to an output.
// That is what makes it testable on a host with no audio device.
//
// Usage:
//   Synth synth;
//   synth.configure(48000);
//   synth.setBusLevel(Bus::Melody, 0.5f);
//   synth.schedule({Bus::Melody, 440.0f, startSample, endSample});
//   // audio callback (real-time thread):
//   synth.render(out, frames);   // no allocation, no locks

#ifndef MICDRP_DSP_SYNTH_H
#define MICDRP_DSP_SYNTH_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace micdrp {

/// What a sound belongs to. Each has its own level, mixed into one output.
enum class Bus : int {
  Take = 0,     ///< the recorded audio, when routed through the engine
  Melody = 1,   ///< the detected melody, played back
  Chords = 2,   ///< the harmonic backdrop
  Audition = 3, ///< a tapped note or chord, heard on its own
  Bass = 4,     ///< the root of each chord, under the rest of it
  Count = 5
};

/// One note to sound: a frequency on a bus, between two samples.
struct ScheduledNote {
  Bus bus = Bus::Melody;
  float frequencyHz = 440.0f;
  /// Both are absolute positions on the engine's own clock.
  std::int64_t startSample = 0;
  std::int64_t endSample = 0;
};

/// How many notes may sound at once before the oldest is stolen.
inline constexpr std::size_t kMaxVoices = 32;

class Synth {
 public:
  Synth();

  /// Set the output rate. Clears anything scheduled: sample positions from a
  /// different rate describe different moments.
  void configure(double sampleRateHz);

  double sampleRate() const { return sampleRate_; }

  /// Level for one bus, 0..1, taking effect on the next rendered block.
  /// Mixing is done by ear while listening, so this must not wait for a
  /// re-schedule (INV-NOTES-027).
  void setBusLevel(Bus bus, float level);
  float busLevel(Bus bus) const;

  /// Add a note. Notes may be scheduled in any order and while rendering.
  void schedule(const ScheduledNote& note);

  /// Drop everything on one bus, or everything everywhere. Sounding voices on
  /// that bus are released rather than cut, so stopping does not click.
  void clearBus(Bus bus);
  void clearAll();

  /// Where the engine has reached, in samples since configure().
  std::int64_t now() const { return now_; }

  /// Render one block of mono samples. Real-time safe: no allocation, no
  /// locks, no system calls.
  void render(float* out, std::size_t frames);

  /// How many voices are sounding. For tests and diagnostics.
  std::size_t activeVoices() const;

 private:
  struct Voice {
    bool active = false;
    Bus bus = Bus::Melody;
    float phase = 0.0f;      ///< 0..1, turns per sample accumulated
    float phaseStep = 0.0f;
    std::int64_t startSample = 0;
    std::int64_t endSample = 0;
    float envelope = 0.0f;   ///< current gain, ramped to avoid clicks
    bool releasing = false;
  };

  /// Start any scheduled note whose moment has come.
  void admit(std::int64_t blockStart, std::int64_t blockEnd);
  Voice* freeVoice();

  double sampleRate_ = 48000.0;
  std::int64_t now_ = 0;
  float busLevels_[static_cast<int>(Bus::Count)] = {1.0f, 1.0f, 1.0f, 1.0f,
                                                    1.0f};
  /// Fixed: a long take must cost no more to play than a short one.
  Voice voices_[kMaxVoices];
  /// Pending notes, kept sorted by start so admission is a walk from the front.
  std::vector<ScheduledNote> pending_;
  std::size_t nextPending_ = 0;
};

}  // namespace micdrp

#endif  // MICDRP_DSP_SYNTH_H
