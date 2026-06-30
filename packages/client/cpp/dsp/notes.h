// notes.h — pitch <-> note conversions.
//
// Portable C++17 port of packages/logic/src/notes.ts (frequencyToMidi,
// frequencyToNote). The TS version is the golden reference; the host parity
// test (cpp/dsp/__tests__/parity_test.cpp) asserts this matches it within
// 1 cent. STL-only, no platform dependencies.

#ifndef MICDRP_DSP_NOTES_H
#define MICDRP_DSP_NOTES_H

namespace micdrp::dsp {

// Concert-A reference, matching notes.ts (A4_HZ / A4_MIDI).
constexpr double kA4Hz = 440.0;
constexpr int kA4Midi = 69;

// Fractional MIDI note number for a frequency (A4/440Hz -> 69).
// Mirrors notes.ts frequencyToMidi.
double frequencyToMidi(double frequencyHz);

// Reference frequency in Hz for a (possibly fractional) MIDI note number.
// Mirrors notes.ts midiToFrequency.
double midiToFrequency(double midi);

// Nearest-note reading. Mirrors the {midi, cents} subset of notes.ts
// NoteReading that the PitchSample contract carries. (name/octave are
// derivable on the JS side from midi and are not part of the wire payload.)
struct NoteReading {
  int midi;     // nearest MIDI note number
  int cents;    // signed cents away from the nearest note, -50..+50
};

// Resolve a frequency to its nearest note plus cents deviation.
// Mirrors notes.ts frequencyToNote (midi + cents fields).
NoteReading frequencyToNote(double frequencyHz);

}  // namespace micdrp::dsp

#endif  // MICDRP_DSP_NOTES_H
