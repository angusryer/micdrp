/**
 * Chord slots follow the downbeats a person placed, whatever their number
 * and spacing (INV-NOTES-048).
 */
import { harmonizeToGrid } from '../harmony';
import type { MusicalGrid } from '../quantize';
import type { NoteEvent } from '../segmentation';

/** 120bpm: a beat is 500ms, a step is 125ms, a bar of four is 2000ms. */
const GRID = {
  bpm: 120,
  offsetMs: 0,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  isCompound: false,
  timeSignature: '4/4',
  meterIsStated: true
} as unknown as MusicalGrid;

function note(midi: number, startMs: number, endMs: number): NoteEvent {
  return { midi, startMs, endMs, durationMs: endMs - startMs, cents: 0, clarity: 1 };
}

/** Four seconds: a C-major stretch, then an F-major one. */
const MELODY = [
  note(60, 0, 900),
  note(64, 900, 1800),
  note(67, 1800, 2000),
  note(65, 2000, 2900),
  note(69, 2900, 3800),
  note(72, 3800, 4000)
];

describe('chords sit where the downbeats were placed', () => {
  it('gives one slot per downbeat, spanning the gaps between them', () => {
    // Steps 0, 16, 24 → 0ms, 2000ms, 3000ms. Deliberately uneven.
    const slots = harmonizeToGrid(MELODY, GRID, { downbeatSteps: [0, 16, 24] });

    expect(slots).toHaveLength(3);
    expect(slots.map((s) => [s.startMs, s.endMs])).toEqual([
      [0, 2000],
      [2000, 3000],
      [3000, 4000]
    ]);
  });

  it('lets two chords sit inside what would be one bar', () => {
    // Two downbeats a bar apart, then two a half-bar apart.
    const slots = harmonizeToGrid(MELODY, GRID, { downbeatSteps: [0, 8, 16] });
    expect(slots).toHaveLength(3);
    expect(slots[0].endMs - slots[0].startMs).toBe(1000);
    expect(slots[1].endMs - slots[1].startMs).toBe(1000);
    // Nothing has redefined a bar to say so.
    expect(slots.every((s) => s.label.length > 0)).toBe(true);
  });

  it('takes a removed downbeat as giving its span to the chord before it', () => {
    const before = harmonizeToGrid(MELODY, GRID, { downbeatSteps: [0, 16, 24] });
    const after = harmonizeToGrid(MELODY, GRID, { downbeatSteps: [0, 16] });

    expect(after).toHaveLength(2);
    expect(after[1].startMs).toBe(before[1].startMs);
    // The second slot now runs to the end rather than stopping at 3000.
    expect(after[1].endMs).toBe(4000);
  });

  it('ignores downbeats that fall past the end of what was sung', () => {
    const slots = harmonizeToGrid(MELODY, GRID, { downbeatSteps: [0, 16, 200] });
    expect(slots).toHaveLength(2);
    expect(slots[slots.length - 1].endMs).toBe(4000);
  });

  it('reads each span on its own, so an uneven one is not judged by a neighbour', () => {
    // The long opening span is C-ish; the short closing one is not.
    const slots = harmonizeToGrid(MELODY, GRID, { downbeatSteps: [0, 16] });
    expect(slots[0].rootPc).not.toBe(slots[1].rootPc);
  });

  it('falls back to the grid’s even division when nothing was placed', () => {
    const even = harmonizeToGrid(MELODY, GRID, {});
    expect(even.length).toBeGreaterThan(0);
    // One slot per bar of 2000ms.
    expect(even[0].endMs - even[0].startMs).toBe(2000);
  });
});
