/**
 * Pitch <-> note conversions.
 *
 * Pure, dependency-free math so the same code runs in Jest, in an audio
 * worklet, or on the server. Uses ES5-safe operations (no `**` / Math.log2)
 * to stay portable across the monorepo's tsconfig targets.
 */

// The chromatic note table and its name type are the domain source of truth in
// `models`; logic re-exports them so existing `from 'logic'` imports (key.ts,
// NoteRibbon, NoteList) keep working without duplicating the literal.
export { NOTE_NAMES, type NoteName } from 'models';

export const A4_HZ = 440;
export const A4_MIDI = 69;

/** Fractional MIDI note number for a frequency (A4/440Hz -> 69). */
export function frequencyToMidi(frequencyHz: number): number {
  return A4_MIDI + 12 * (Math.log(frequencyHz / A4_HZ) / Math.LN2);
}

/** Reference frequency in Hz for a (possibly fractional) MIDI note number. */
export function midiToFrequency(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export interface NoteReading {
  /** Nearest MIDI note number. */
  midi: number;
  /** Chromatic name of the nearest note. */
  name: NoteName;
  /** Scientific-pitch octave. */
  octave: number;
  /** Signed cents away from the nearest note, −50..+50. */
  cents: number;
}

/** Resolve a frequency to its nearest note plus cents deviation. */
export function frequencyToNote(frequencyHz: number): NoteReading {
  const midiFloat = frequencyToMidi(frequencyHz);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const index = ((midi % 12) + 12) % 12;
  const name = NOTE_NAMES[index];
  const octave = Math.floor(midi / 12) - 1;
  return { midi, name, octave, cents };
}
