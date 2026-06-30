// notes.cpp — see notes.h. Mechanical port of packages/logic/src/notes.ts.

#include "notes.h"

#include <cmath>

namespace micdrp::dsp {

double frequencyToMidi(double frequencyHz) {
  // notes.ts: A4_MIDI + 12 * (Math.log(f / A4_HZ) / Math.LN2)
  // std::log is natural log; M_LN2 may be absent under -std=c++17 strict, so
  // use std::log(2.0) for portability.
  return static_cast<double>(kA4Midi) +
         12.0 * (std::log(frequencyHz / kA4Hz) / std::log(2.0));
}

double midiToFrequency(double midi) {
  // notes.ts: A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12)
  return kA4Hz * std::pow(2.0, (midi - static_cast<double>(kA4Midi)) / 12.0);
}

NoteReading frequencyToNote(double frequencyHz) {
  const double midiFloat = frequencyToMidi(frequencyHz);
  // JS Math.round: round half up toward +Infinity. std::round rounds half away
  // from zero, which differs only at exact .5 boundaries; mirror JS exactly.
  const int midi = static_cast<int>(std::floor(midiFloat + 0.5));
  const int cents =
      static_cast<int>(std::floor((midiFloat - static_cast<double>(midi)) * 100.0 + 0.5));
  return NoteReading{midi, cents};
}

}  // namespace micdrp::dsp
