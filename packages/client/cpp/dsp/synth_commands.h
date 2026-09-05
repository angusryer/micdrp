// synth_commands.h — building mailbox commands from what a caller says.
//
// A platform layer speaks in bus numbers and milliseconds, because that is
// what crosses a language boundary cheaply. The Synth speaks in Bus values
// and sample positions. This is the translation, kept here rather than in
// the ObjC++ shell so the rounding has a name and a host test: a note's
// start is the moment it is asked for, to the nearest sample, and a bus
// number nobody recognises does not index past the end of the levels array.
//
// Every function is safe to call from any thread that owns the producer end
// of the mailbox; none of them block.

#ifndef MICDRP_DSP_SYNTH_COMMANDS_H
#define MICDRP_DSP_SYNTH_COMMANDS_H

#include "synth_mailbox.h"

namespace micdrp {

/// A bus number as the JS contract numbers them: 0 Take, 1 Melody, 2 Chords,
/// 3 Audition. Anything else reads as Melody — there is no way to fail a
/// call on the audio path, and a silent wrong bus beats an out-of-range one.
Bus busFromIndex(double index);

/// Milliseconds on the engine's clock to a sample position on it, rounded to
/// the nearest sample rather than truncated: truncation would place every
/// note fractionally early, which over a long take reads as drift.
std::int64_t samplesFromMs(double ms, double sampleRateHz);

/// Post one note. Returns false when the ring is full and the note was not
/// accepted, which the caller may want to report.
bool postSchedule(SynthMailbox& mailbox, double busIndex, double frequencyHz,
                  double startMs, double endMs, double sampleRateHz);

/// Post a passage of recorded audio to sound: which resident slot, how far
/// into it to begin, and the span on the engine's clock (INV-NOTES-133).
/// Milliseconds here too, because that is what the caller has.
bool postScheduleSample(SynthMailbox& mailbox, double busIndex, double slot,
                        double fromMs, double startMs, double endMs,
                        double sampleRateHz);

/// Hand the audio thread a block of audio to hold, or clear the slot with a
/// null one. The frames must outlive every voice that may read them, which
/// is the caller's promise to keep — see SampleData.
bool postSetSample(SynthMailbox& mailbox, double slot, const float* frames,
                   std::size_t frameCount);

bool postBusLevel(SynthMailbox& mailbox, double busIndex, double level);

/// What a bus sounds like (INV-NOTES-144). An unrecognised shape reads as a
/// sine — a wrong timbre beats a crash on the audio path, and a sine is what
/// every bus sounded like before any of them could be told otherwise.
bool postBusWave(SynthMailbox& mailbox, double busIndex, double wave);
/// Begin a run: time passes from `fromMs` of the material, starting at
/// `startMs` on the engine clock, until `endMs`. Separate from scheduling
/// the audio, because a run is time passing and a voice is a sound
/// (INV-TPORT-013).
bool postStartTransport(SynthMailbox& mailbox, double fromMs, double startMs,
                        double endMs, double sampleRateHz);

/// End the run now. The position stays where it reached.
bool postStopTransport(SynthMailbox& mailbox);

bool postClearBus(SynthMailbox& mailbox, double busIndex);
bool postClearAll(SynthMailbox& mailbox);

}  // namespace micdrp

#endif  // MICDRP_DSP_SYNTH_COMMANDS_H
