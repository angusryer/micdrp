/**
 * What a shared take carries, and what its directory is called.
 *
 * Pure, so the rules a sample is made by can be checked without a device,
 * a network, or a recording. INV-DOG-031, INV-DOG-032.
 */
import { readingOf, sampleDirName, slugOfTitle } from '../dto/takeSample';

const heard = [
  { midi: 60, startMs: 0, endMs: 500, cents: 4 },
  { midi: 64, startMs: 500, endMs: 900, cents: -8 }
];

const take = {
  melody: heard,
  noteCount: 2,
  analysisVersion: 3,
  key: 'C major',
  tempoBpm: 96
};

describe('the reading a sample carries', () => {
  it('carries what the detector heard, and what produced it', () => {
    const reading = readingOf(take);
    expect(reading.melody).toEqual(heard);
    expect(reading.analysisVersion).toBe(3);
    expect(reading.noteCount).toBe(2);
  });

  it('writes an unmeasured value as null rather than leaving it off', () => {
    // A corpus has to tell "the app found no key" from "this sample
    // predates keys", and an absent field cannot say which.
    const reading = readingOf({ melody: [], noteCount: 0 });
    expect(reading.key).toBeNull();
    expect(reading.inTuneRatio).toBeNull();
    expect(reading.rangeLowMidi).toBeNull();
  });

  it('carries what the person did, not only what the app decided', () => {
    // A tapped beat says what the tempo detector should have found as
    // plainly as a corrected note says what the pitch detector missed.
    const interpretations = [
      { id: 'r1', createdAtMs: 1, chords: [], beats: [{ atMs: 500 }] }
    ] as never;
    expect(readingOf({ ...take, interpretations }).interpretations).toEqual(
      interpretations
    );
  });

  it('says there were none rather than leaving the field off', () => {
    expect(readingOf(take).interpretations).toEqual([]);
  });

  it('carries corrections, which say what it should have been', () => {
    const corrected = [{ ...heard[0], midi: 62 }, heard[1]];
    expect(readingOf(take, corrected).corrected).toEqual(corrected);
  });

  it('does not call an untouched melody a correction', () => {
    // Storing it would read as somebody having confirmed the take note by
    // note when they did nothing at all.
    expect(readingOf(take, heard).corrected).toBeUndefined();
  });
});

describe('what a sample is called on disk', () => {
  it('sorts by day, reads as a title, and cannot collide', () => {
    expect(
      sampleDirName({
        id: 'abc123def456ghi',
        title: 'Chorus idea',
        sharedAtMs: Date.UTC(2026, 8, 4, 12)
      })
    ).toBe('2026-09-04-chorus-idea-abc123def456ghi');
  });

  it('keeps a title a filesystem will take', () => {
    expect(slugOfTitle('Take 3 — "the bridge?"')).toBe('take-3-the-bridge');
  });

  it('names a take that has no name at all', () => {
    // The id after it still makes the directory unique; this only has to
    // be legible.
    expect(slugOfTitle('???')).toBe('take');
  });
});
