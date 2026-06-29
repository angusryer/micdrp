/**
 * Core pitch/note domain types shared across micdrp.
 *
 * These are intentionally framework-agnostic (no React Native / audio-engine
 * imports) so they can be used from the client, a worklet, the server, or
 * tests without pulling in native dependencies.
 */

/** The twelve chromatic note names, indexed so that `NOTE_NAMES[0] === 'C'`. */
export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

/** A musical note resolved from a frequency. */
export interface Note {
  /** MIDI note number (A4 = 69). */
  midi: number;
  /** Chromatic name, e.g. 'A'. */
  name: NoteName;
  /** Scientific-pitch octave (A4 lives in octave 4). */
  octave: number;
  /** The reference frequency of the note itself, in Hz. */
  frequencyHz: number;
}

/**
 * A single analysed frame of audio: the detected pitch plus the metadata the
 * app surfaces (clarity/accuracy). `frequencyHz` is null when no pitch was
 * confidently detected (e.g. silence or unvoiced sound).
 */
export interface PitchSample {
  /** Milliseconds from the start of the recording. */
  timestampMs: number;
  /** Detected fundamental frequency in Hz, or null if none. */
  frequencyHz: number | null;
  /** MPM clarity for the frame, in [0, 1]. */
  clarity: number;
  /** Nearest MIDI note number, or null when no pitch was detected. */
  midi: number | null;
  /** Cents away from the nearest note (−50..+50), or null. */
  cents: number | null;
}
