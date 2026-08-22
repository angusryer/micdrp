/**
 * Metre read back from the placed downbeats, never constraining them
 * (INV-NOTES-050).
 */
import { gapsInBeats, readMetre, statedMetre } from '../metre';
import type { MusicalGrid } from '../quantize';

/** Four steps to a beat. */
const GRID = {
  bpm: 120,
  offsetMs: 0,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  isCompound: false,
  timeSignature: '4/4',
  meterIsStated: false
} as unknown as MusicalGrid;

describe('reading the gaps', () => {
  it('measures them in beats, rounding through a tempo that is a hair off', () => {
    expect(gapsInBeats([0, 16, 32], 4)).toEqual([4, 4]);
    // 15 steps is 3.75 beats, which is four beats measured imperfectly.
    expect(gapsInBeats([0, 15, 31], 4)).toEqual([4, 4]);
  });

  it('ignores duplicates and disorder', () => {
    expect(gapsInBeats([32, 0, 16, 16], 4)).toEqual([4, 4]);
  });
});

describe('the metre a set of downbeats implies', () => {
  it('reads a downbeat every four beats as four four', () => {
    expect(readMetre([0, 16, 32, 48], GRID).label).toBe('4/4');
  });

  it('reads half-bar harmony as four four, not two four', () => {
    // A chord every two beats. Two would fit, but four is the better guess
    // and every gap divides into it.
    expect(readMetre([0, 8, 16, 24, 32], GRID).label).toBe('4/4');
  });

  it('reads a waltz as three four', () => {
    expect(readMetre([0, 12, 24, 36], GRID).label).toBe('3/4');
  });

  it('gives a take with its own shape the gap it actually has', () => {
    // Gaps of five beats: nothing common divides evenly, so five it is.
    expect(readMetre([0, 20, 40, 60], GRID).label).toBe('5/4');
  });

  it('falls back to the grid when nothing has been placed', () => {
    expect(readMetre([], GRID).beatsPerBar).toBe(4);
    expect(readMetre([0], GRID).beatsPerBar).toBe(4);
  });

  it('never claims to be stated when it was read', () => {
    expect(readMetre([0, 16, 32], GRID).isStated).toBe(false);
  });

  it('counts a compound grid in eighths', () => {
    const compound = { ...GRID, isCompound: true } as unknown as MusicalGrid;
    expect(readMetre([0, 24, 48], compound).label).toBe('6/8');
  });
});

describe('a person stating the metre', () => {
  it('replaces the reading outright, and says so', () => {
    // Three half notes are six beats to any arithmetic; only the singer
    // knows they meant four four.
    const read = readMetre([0, 8, 16, 24], GRID);
    const stated = statedMetre(4);
    expect(stated.label).toBe('4/4');
    expect(stated.isStated).toBe(true);
    expect(stated.isStated).not.toBe(read.isStated);
  });

  it('takes a stated unit when given one', () => {
    expect(statedMetre(6, 8).label).toBe('6/8');
  });
});
