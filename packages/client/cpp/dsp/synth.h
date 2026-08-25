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
// It plays recorded audio too. A take is not a tone, but it is a thing that
// starts at a moment and stops at one, and the only way it can be exactly in
// time with the tones is to be on their clock — so it is a voice like any
// other, reading frames instead of turning a phase (INV-NOTES-133).
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
/**
 * How many mixer buses exist.
 *
 * A capacity rather than a count of named things. The synth's entire notion of
 * a bus is an index into a level array — it does not know what "chords" means
 * and has never needed to. Naming them here made every new track a change to
 * this file, an Xcode build and a TestFlight upload, to add a number that the
 * caller already knew (INV-NOTES-121).
 *
 * Sixteen because the array is sixteen floats and the cost of the headroom is
 * nothing at all next to the cost of a build.
 */
constexpr int kMaxBuses = 16;

/**
 * The buses this file's own tests use. Not a registry: what a bus means is
 * decided in TS, and anything in range is valid whether it is named here or
 * not (INV-NOTES-121).
 */
enum class Bus : int {
  Take = 0,     ///< the recorded audio, when routed through the engine
  Melody = 1,   ///< the detected melody, played back
  Chords = 2,   ///< the harmonic backdrop
  Audition = 3, ///< a tapped note or chord, heard on its own
  Bass = 4,     ///< the root of each chord, under the rest of it
  Click = 5,    ///< the metronome, keeping time through the take
  Rhythm = 6    ///< the struck sounds read out of the take
};

/**
 * How many blocks of recorded audio may be resident at once.
 *
 * A take and the layers sung over it. Like the buses, a capacity rather than
 * a list: what a slot holds is decided by the caller (INV-NOTES-133).
 */
constexpr int kMaxSamples = 8;

/**
 * One block of recorded audio, resident and ready to sound.
 *
 * Mono, already at the engine's rate: converting while rendering would be a
 * per-sample cost on the audio thread for a conversion that is identical
 * every time it is done (INV-NOTES-133).
 *
 * The frames are NOT owned here. The audio thread holds this pointer for as
 * long as a voice is reading it, which is what keeps rendering
 * allocation-free — so whoever loaded the audio must keep it alive until no
 * voice can still be inside it. Freeing on replacement is a read of freed
 * memory in the render callback.
 */
struct SampleData {
  const float* frames = nullptr;
  std::size_t frameCount = 0;
};

/**
 * One sound to make: a tone or a passage of recorded audio, on a bus,
 * between two moments.
 *
 * Both at once rather than two schedules, because they are the same claim —
 * this bus makes this sound from here to here — and splitting them would be
 * two paths to keep in step (INV-NOTES-133).
 */
struct ScheduledNote {
  Bus bus = Bus::Melody;
  /// A tone, when positive. Ignored when a sample slot is named.
  float frequencyHz = 440.0f;
  /// Both are absolute positions on the engine's own clock.
  std::int64_t startSample = 0;
  std::int64_t endSample = 0;
  /// Which resident audio to play, or -1 for a tone. Last, with the frame
  /// below it, so the four fields a tone needs keep the order they had.
  int sampleSlot = -1;
  /// How far into that audio to begin, in frames. Where a take resumes from.
  std::int64_t sourceFrame = 0;
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

  /**
   * Hand the engine a block of recorded audio to hold, or clear a slot with
   * an empty one. Takes effect for notes admitted after it.
   *
   * The frames must outlive every voice reading them (see SampleData). A
   * voice already sounding keeps the audio it started with, so replacing a
   * slot never changes what is currently being heard (INV-NOTES-133).
   */
  void setSample(int slot, SampleData data);
  SampleData sample(int slot) const;

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
    /// Whether this voice plays recorded audio rather than a tone. Asked of
    /// the note, not of the audio: a slot that turned out to be empty is a
    /// take with nothing in it, which is silence — never a 440Hz tone
    /// (INV-NOTES-133).
    bool isSample = false;
    /// Bound at admission and held to the end, so replacing a slot cannot
    /// change what a sounding voice is reading (INV-NOTES-133).
    const float* source = nullptr;
    std::size_t sourceCount = 0;
    std::int64_t sourcePos = 0;
  };

  /// Start any scheduled note whose moment has come.
  void admit(std::int64_t blockStart, std::int64_t blockEnd);
  Voice* freeVoice();

  double sampleRate_ = 48000.0;
  std::int64_t now_ = 0;
  /// Every bus starts audible; a caller that wants one quiet says so.
  float busLevels_[kMaxBuses] = {1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f,
                                 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f,
                                 1.0f};
  /// Fixed: a long take must cost no more to play than a short one.
  Voice voices_[kMaxVoices];
  /// Borrowed, never owned. See SampleData.
  SampleData samples_[kMaxSamples];
  /// Pending notes, kept sorted by start so admission is a walk from the front.
  std::vector<ScheduledNote> pending_;
  std::size_t nextPending_ = 0;
};

}  // namespace micdrp

#endif  // MICDRP_DSP_SYNTH_H
