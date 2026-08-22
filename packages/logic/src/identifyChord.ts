/**
 * identifyChord — what a set of notes spells, if it spells anything.
 *
 * The inverse of voicing: that turns a chord into notes, this reads notes
 * back into a chord. Dragging notes about is how a chord is built on the
 * graph, so a shape has to be able to say what it has become — a chord that
 * kept its old name while sounding like something else would be the interface
 * lying about what was just made (INV-NOTES-036).
 *
 * Uses the same templates the harmony reading does, so "what chord is this"
 * has one answer in this codebase however it is asked.
 */
import { CHORD_TONES, type ChordQuality } from './chordTones';

export interface ChordIdentity {
  rootPc: number;
  quality: ChordQuality;
}

/** Pitch classes, deduplicated and ordered. */
function classesOf(midis: readonly number[]): number[] {
  const set = new Set<number>();
  for (const midi of midis) {
    set.add(((Math.round(midi) % 12) + 12) % 12);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * The chord a set of notes spells exactly, or null.
 *
 * Exact rather than nearest: a nearest match would rename a chord to
 * something it merely resembles, and the whole value of renaming is that it
 * is true. Notes that spell nothing keep their slot's existing name and are
 * marked altered instead, which says "this is a chord you invented" rather
 * than guessing which known one you meant.
 *
 * `bassPc`, when given, breaks ties in favour of the chord rooted there — the
 * lowest note is what the ear takes as the root.
 */
export function identifyChord(
  midis: readonly number[],
  bassPc?: number
): ChordIdentity | null {
  const classes = classesOf(midis);
  if (classes.length < 3) {
    // Two notes are an interval, and an interval belongs to several chords
    // equally. Naming one would be a guess dressed as a reading.
    return null;
  }

  const matches: ChordIdentity[] = [];
  for (let root = 0; root < 12; root++) {
    for (const quality of Object.keys(CHORD_TONES) as ChordQuality[]) {
      const wanted = CHORD_TONES[quality]
        .map((offset) => (root + offset) % 12)
        .sort((a, b) => a - b);
      if (
        wanted.length === classes.length &&
        wanted.every((pc, i) => pc === classes[i])
      ) {
        matches.push({ rootPc: root, quality });
      }
    }
  }
  if (matches.length === 0) {
    return null;
  }
  // A diminished seventh is the same four notes from any of its four roots,
  // so the bass decides. Without one, the first is as good as any.
  const rooted =
    bassPc == null
      ? undefined
      : matches.find((m) => m.rootPc === ((bassPc % 12) + 12) % 12);
  return rooted ?? matches[0];
}
