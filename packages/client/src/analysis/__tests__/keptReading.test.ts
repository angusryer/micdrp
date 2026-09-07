/**
 * ACC-NOTES-229 / INV-NOTES-215 — reading a take again can be undone.
 *
 * Reading again overwrote the melody, the hits and the summary with no way
 * back. Every threshold the reader uses is set once for the app rather than
 * per take, so a tuning arrived at against a recent close-sung take is what
 * an old quiet one gets read with — and whether that is better is a
 * judgement only the person who sang it can make.
 *
 * Offering an irreversible action on the one part of a note that cannot be
 * recomputed from anything else is the shape of this domain's worst faults.
 * The audio can be read again; a reading somebody had accepted, and the
 * edits anchored into it, cannot be got back by any amount of re-reading.
 */
import {
  forgetKeptReading,
  keepReading,
  keptReading,
  type KeptReading
} from '../keptReading';

const NOTE = 'note-being-read';

const reading = (midi: number): KeptReading => ({
  melody: [{ midi, startMs: 0, endMs: 500 }],
  hits: [],
  analysisVersion: 3
});

beforeEach(() => forgetKeptReading(NOTE));

describe('a take that has not been read again', () => {
  it('has nothing to put back', () => {
    expect(keptReading(NOTE)).toBeNull();
  });
});

describe('a take read again', () => {
  it('ACC-NOTES-229: keeps what it read as before', () => {
    keepReading(NOTE, reading(60));
    expect(keptReading(NOTE)?.melody).toEqual([
      { midi: 60, startMs: 0, endMs: 500 }
    ]);
  });

  it('keeps the hits and the version with it', () => {
    keepReading(NOTE, { ...reading(60), hits: [{ atMs: 10 }] });
    expect(keptReading(NOTE)?.hits).toEqual([{ atMs: 10 }]);
    expect(keptReading(NOTE)?.analysisVersion).toBe(3);
  });

  it('keeps one deep, not a stack nobody is tracking', () => {
    // The answer to "put it back" is the reading you were looking at, not
    // one from further up a pile.
    keepReading(NOTE, reading(60));
    keepReading(NOTE, reading(67));
    expect(keptReading(NOTE)?.melody).toEqual([
      { midi: 67, startMs: 0, endMs: 500 }
    ]);
  });

  it('forgets the way back once it has been taken', () => {
    keepReading(NOTE, reading(60));
    forgetKeptReading(NOTE);
    expect(keptReading(NOTE)).toBeNull();
  });

  it('keeps one take’s reading to itself', () => {
    keepReading(NOTE, reading(60));
    expect(keptReading('some-other-note')).toBeNull();
  });
});

describe('something stored that is not a reading', () => {
  it('is refused rather than offered as a way back', () => {
    // A half-written or hand-edited value must not be handed to the repo as
    // though it were a melody.
    keepReading(NOTE, { melody: 'not a list' } as unknown as KeptReading);
    expect(keptReading(NOTE)).toBeNull();
  });
});
