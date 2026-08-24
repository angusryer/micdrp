/**
 * INV-NOTES-115 — a take is read according to what it was recorded as.
 *
 * The first take of an idea is somebody switching between humming and
 * drumming without announcing it, so it has to be read both ways and guessed
 * at. A track recorded deliberately as a bass line is all notes; one recorded
 * as drums is all hits.
 *
 * Knowing which is worth more than cleverness on ambiguous input. Told that a
 * track is drums, the reader stops asking whether each sound might have been
 * a note, and every borderline case resolves the right way rather than being
 * argued about.
 */
import { readTake } from '../readTake';
import type { PitchFrame } from '../segmentation';

const HOP = 10;

const frames = (
  count: number,
  at: number,
  make: (i: number) => Partial<PitchFrame>
): PitchFrame[] =>
  Array.from({ length: count }, (_, i) => ({
    timestampMs: at + i * HOP,
    midi: null,
    cents: null,
    clarity: 0,
    levelDb: -75,
    centroidHz: 0,
    flatness: 0,
    ...make(i)
  }));

const sung = (at: number, ms: number) =>
  frames(Math.ceil(ms / HOP), at, () => ({
    midi: 62,
    cents: 0,
    clarity: 0.95,
    levelDb: -14,
    centroidHz: 294,
    flatness: 0.02
  }));

const struck = (at: number, ms: number, centroidHz = 300) =>
  frames(Math.ceil(ms / HOP), at, () => ({
    clarity: 0.1,
    levelDb: -14,
    centroidHz,
    flatness: 0.7
  }));

const silence = (at: number, ms: number) => frames(Math.ceil(ms / HOP), at, () => ({}));

/** A take with both in it, which is what a first take actually is. */
const BOTH = [
  ...struck(0, 50),
  ...silence(50, 200),
  ...sung(250, 700),
  ...silence(950, 150),
  ...struck(1100, 50, 6000)
];

describe('a take nobody declared', () => {
  it('reads both, because it has to guess', () => {
    const { notes, hits } = readTake(BOTH, 'mixed');
    expect(notes.length).toBeGreaterThan(0);
    expect(hits).toHaveLength(2);
  });
});

describe('a take recorded as one thing', () => {
  it('reads a bass line as notes and looks for no drums in it', () => {
    // Nothing to gain from guessing: it was declared.
    const { notes, hits } = readTake(BOTH, 'bass');
    expect(notes.length).toBeGreaterThan(0);
    expect(hits).toEqual([]);
  });

  it('reads a melody the same way', () => {
    expect(readTake(BOTH, 'melody').hits).toEqual([]);
  });

  it('reads a drum track as hits and finds no notes in it', () => {
    const { notes, hits } = readTake(BOTH, 'drums');
    expect(notes).toEqual([]);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('hears a softer, longer hit once it is told there is no singing', () => {
    // The mixed reading has to be strict, because a long quiet unpitched
    // stretch might be a sigh. A declared drum track has no such doubt.
    const soft = struck(0, 190, 300).map((f) => ({ ...f, levelDb: -50 }));
    expect(readTake(soft, 'mixed').hits).toEqual([]);
    expect(readTake(soft, 'drums').hits).toHaveLength(1);
  });
});

describe('what every role agrees on', () => {
  it('finds nothing in silence, whatever it was recorded as', () => {
    for (const role of ['mixed', 'melody', 'bass', 'drums'] as const) {
      const { notes, hits } = readTake(silence(0, 500), role);
      expect(notes).toEqual([]);
      expect(hits).toEqual([]);
    }
  });

  it('reads the same notes for every role that has notes at all', () => {
    const melody = readTake(BOTH, 'melody').notes;
    const bass = readTake(BOTH, 'bass').notes;
    const mixed = readTake(BOTH, 'mixed').notes;
    // The role decides WHAT is looked for, not what a note is. Two roles
    // disagreeing about the same singing would be two segmenters again.
    expect(bass).toEqual(melody);
    expect(mixed).toEqual(melody);
  });
});
