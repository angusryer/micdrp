/**
 * How long the beat is at one moment — INV-NOTES-245.
 *
 * A note written into a phrase that was stretched should be a quarter of
 * *that* beat, not a quarter of the average, which is the whole reason this
 * reads the timeline rather than the tempo.
 */
import { timelineFromAnchors } from 'logic';

import { beatLengthAt } from '../beatLengthAt';

/**
 * A take whose beats run 600, then 900, then 700 — a phrase leaned into
 * and let go of.
 *
 * Not 600/1800/600: a gap three times its neighbours is read as a missed
 * tap and filled, which is right (INV-NOTES-236) and would make this a
 * test of the fill rather than of the stretch.
 */
const breathing = timelineFromAnchors(
  [
    { atMs: 0, isDownbeat: false },
    { atMs: 600, isDownbeat: false },
    { atMs: 1500, isDownbeat: false },
    { atMs: 2200, isDownbeat: false }
  ],
  0,
  2200
)!;

describe('beatLengthAt', () => {
  it('reads the long beat inside a phrase that was stretched', () => {
    // Not 700, which the tempo would have said, and not 733, the average.
    expect(beatLengthAt(breathing, 100, 1000)).toBe(900);
  });

  it('reads the shorter beats either side of it', () => {
    expect(beatLengthAt(breathing, 100, 300)).toBe(600);
    expect(beatLengthAt(breathing, 100, 1800)).toBe(700);
  });

  it('falls back to the tempo where there are no beats', () => {
    expect(beatLengthAt(null, 100, 1000)).toBe(600);
  });

  it('is short and visible where there is not even a tempo', () => {
    const length = beatLengthAt(null, 0, 1000);
    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThan(1000);
  });
});
