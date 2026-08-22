/**
 * Where the chord lane puts each chord — INV-NOTES-029.
 *
 * The point of the lane is that a chord is drawn under the notes it was read
 * from, so the arithmetic worth pinning down is the shared time axis: a band
 * lands on the melody's axis, and a chord that overhangs the take is clipped
 * to it rather than dropped or drawn outside the graph.
 */
import type { ChordSlot } from 'logic';

import { layoutChordLane } from '../chordLaneModel';

/** A take running 0–4000ms across 100px of inner width, inset 6px. */
const AXIS = { t0: 0, span: 4000, pad: 6, innerW: 100 };

const slot = (startMs: number, endMs: number, over = {}): ChordSlot =>
  ({
    bar: 1,
    startMs,
    endMs,
    rootPc: 0,
    quality: 'maj',
    label: 'C',
    roman: 'I',
    confidence: 1,
    isEdited: false,
    ...over
  }) as unknown as ChordSlot;

describe('layoutChordLane', () => {
  it('puts a band where the chord falls on the melody axis', () => {
    const bands = layoutChordLane([slot(0, 2000), slot(2000, 4000)], AXIS);
    expect(bands).toEqual([
      { index: 0, x: 6, width: 50, label: 'C', isEdited: false },
      { index: 1, x: 56, width: 50, label: 'C', isEdited: false }
    ]);
  });

  it('clips a chord that overhangs the take instead of dropping it', () => {
    // The grid starts at the first bar line, which is usually before the first
    // note and after the last, so the outer chords of most takes overhang.
    const bands = layoutChordLane([slot(-1000, 1000), slot(3000, 9000)], AXIS);
    expect(bands.map((b) => [b.x, b.width])).toEqual([
      [6, 25],
      [81, 25]
    ]);
  });

  it('drops a chord that lies entirely outside the take', () => {
    expect(layoutChordLane([slot(5000, 7000)], AXIS)).toEqual([]);
  });

  it('keeps the index of the card that edits the chord', () => {
    const bands = layoutChordLane([slot(-9000, -8000), slot(0, 4000)], AXIS);
    expect(bands).toHaveLength(1);
    expect(bands[0].index).toBe(1);
  });

  it('says which chords were chosen by hand', () => {
    const bands = layoutChordLane(
      [slot(0, 4000, { isEdited: true, label: 'Dm' })],
      AXIS
    );
    expect(bands[0]).toMatchObject({ label: 'Dm', isEdited: true });
  });

  it('draws nothing when the take has no span to lay chords across', () => {
    expect(layoutChordLane([slot(0, 4000)], { ...AXIS, span: 0 })).toEqual([]);
  });
});
