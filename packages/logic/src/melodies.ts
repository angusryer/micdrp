/**
 * Practice melodies — deterministic target exercises to sing against.
 *
 * Each melody builds an absolute-timed {@link TargetNote}[] that the scoring
 * pipeline ({@link scorePitch}) and the reference-tone player both consume. The
 * notes are pure music theory (scales, arpeggios, intervals, a nursery tune), so
 * they are generated rather than stored — transpose with `rootMidi`, change the
 * pace with `noteDurationMs`.
 *
 * Pure and dependency-free (only the `TargetNote` type from `scoring`).
 */
import type { TargetNote } from './scoring';

export interface MelodyOptions {
  /** Tonic MIDI note the exercise is built from (default 60 = C4). */
  rootMidi?: number;
  /** Duration of each note in ms (default 500). */
  noteDurationMs?: number;
}

export interface PracticeMelody {
  /** Stable id (used as a selection key / storage value). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description of the exercise. */
  description: string;
  /** Build the absolute-timed target notes. */
  build(options?: MelodyOptions): TargetNote[];
}

const DEFAULT_ROOT_MIDI = 60; // C4
const DEFAULT_NOTE_MS = 500;

/**
 * Turn a sequence of semitone offsets (relative to the root) into contiguous,
 * non-overlapping target notes. `startMs`/`endMs` tile the timeline back-to-back
 * so `scorePitch` finds exactly one target per instant.
 */
export function sequenceToTargets(
  semitoneOffsets: readonly number[],
  options: MelodyOptions = {}
): TargetNote[] {
  const root = options.rootMidi ?? DEFAULT_ROOT_MIDI;
  const dur = options.noteDurationMs ?? DEFAULT_NOTE_MS;
  return semitoneOffsets.map((semitone, i) => ({
    midi: root + semitone,
    startMs: i * dur,
    endMs: (i + 1) * dur
  }));
}

// Semitone patterns (relative to the tonic), ascending then descending where it
// makes the exercise sing as a there-and-back phrase.
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0];
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0];
const MAJOR_ARPEGGIO = [0, 4, 7, 12, 7, 4, 0];
const PERFECT_FIFTHS = [0, 7, 0, 7, 0, 7, 0];
const OCTAVE_LEAPS = [0, 12, 0, 12, 0, 12, 0];
// "Twinkle, Twinkle" opening phrase: C C G G A A G.
const TWINKLE = [0, 0, 7, 7, 9, 9, 7];

/** The built-in catalogue, in a sensible practice order (easiest first). */
export const PRACTICE_MELODIES: readonly PracticeMelody[] = [
  {
    id: 'major-scale',
    name: 'Major scale',
    description: 'Up and back down a major scale — the core intonation drill.',
    build: (o) => sequenceToTargets(MAJOR_SCALE, o)
  },
  {
    id: 'minor-scale',
    name: 'Natural minor scale',
    description: 'Up and back down a natural minor scale.',
    build: (o) => sequenceToTargets(NATURAL_MINOR_SCALE, o)
  },
  {
    id: 'major-arpeggio',
    name: 'Major arpeggio',
    description: 'Root, third, fifth, octave and back — practise clean leaps.',
    build: (o) => sequenceToTargets(MAJOR_ARPEGGIO, o)
  },
  {
    id: 'perfect-fifths',
    name: 'Perfect fifths',
    description: 'Alternate the tonic and its fifth to lock interval accuracy.',
    build: (o) => sequenceToTargets(PERFECT_FIFTHS, o)
  },
  {
    id: 'octave-leaps',
    name: 'Octave leaps',
    description: 'Jump a full octave and back to stretch your range.',
    build: (o) => sequenceToTargets(OCTAVE_LEAPS, o)
  },
  {
    id: 'twinkle',
    name: 'Twinkle, Twinkle',
    description: 'A familiar tune to warm up with.',
    build: (o) => sequenceToTargets(TWINKLE, o)
  }
];

/** Look up a melody by id, or undefined when unknown. */
export function findMelody(id: string): PracticeMelody | undefined {
  return PRACTICE_MELODIES.find((m) => m.id === id);
}
