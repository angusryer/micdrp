/**
 * INV-NOTES-058 / INV-NOTES-059 — hearing a melody in another register.
 *
 * The thing worth pinning is what does *not* change. A transposition is a
 * listening aid, and the moment it starts editing the take it has become a
 * way to quietly lose what was sung.
 */
import {
  MAX_MIDI,
  MIN_MIDI,
  octaveLabel,
  octaveRoom,
  SEMITONES_PER_OCTAVE,
  transposeMidi,
  transposeTargets
} from '../transpose';
import type { TargetNote } from '../scoring';

const TAKE: TargetNote[] = [
  { midi: 48.3, startMs: 0, endMs: 400 },
  { midi: 52, startMs: 400, endMs: 800 },
  { midi: 55.5, startMs: 800, endMs: 1200 }
];

describe('moving a melody by octaves', () => {
  it('INV-NOTES-058: shifts every pitch by exactly an octave', () => {
    const up = transposeTargets(TAKE, 1);
    up.forEach((note, i) => {
      expect(note.midi - TAKE[i].midi).toBe(SEMITONES_PER_OCTAVE);
    });
    const down = transposeTargets(TAKE, -2);
    down.forEach((note, i) => {
      expect(note.midi - TAKE[i].midi).toBe(-2 * SEMITONES_PER_OCTAVE);
    });
  });

  it('INV-NOTES-058: leaves timing and cents alone', () => {
    const moved = transposeTargets(TAKE, 2);
    expect(moved.map((n) => [n.startMs, n.endMs])).toEqual(
      TAKE.map((n) => [n.startMs, n.endMs])
    );
    // Fractional MIDI carries the cents. Moving register is not an excuse to
    // start rounding (INV-NOTES-026).
    expect(moved[0].midi % 1).toBeCloseTo(TAKE[0].midi % 1, 10);
  });

  it('INV-NOTES-058: does not touch what it was given', () => {
    const before = JSON.stringify(TAKE);
    transposeTargets(TAKE, 3);
    expect(JSON.stringify(TAKE)).toBe(before);
  });

  it('a tap agrees with playing the melody', () => {
    expect(transposeMidi(60, 1)).toBe(transposeTargets(
      [{ midi: 60, startMs: 0, endMs: 1 }],
      1
    )[0].midi);
  });

  it('INV-NOTES-059: offers only shifts that keep every note in range', () => {
    const room = octaveRoom([60, 64, 67], 3);
    expect(room).toEqual({ down: 3, up: 3 });

    // Near the ceiling: less room above, plenty below.
    const high = octaveRoom([120], 3);
    expect(high.up).toBe(0);
    expect(high.down).toBe(3);

    // Near the floor, the other way about.
    const low = octaveRoom([6], 3);
    expect(low.down).toBe(0);
    expect(low.up).toBe(3);
  });

  it('INV-NOTES-059: every offered shift really does stay in range', () => {
    const melody = [14, 40, 113];
    const { down, up } = octaveRoom(melody, 3);
    for (let n = -down; n <= up; n += 1) {
      for (const midi of melody) {
        const moved = transposeMidi(midi, n);
        expect(moved).toBeGreaterThanOrEqual(MIN_MIDI);
        expect(moved).toBeLessThanOrEqual(MAX_MIDI);
      }
    }
  });

  it('a melody wider than MIDI itself offers nothing rather than clamping', () => {
    expect(octaveRoom([2, 126], 3)).toEqual({ down: 0, up: 0 });
  });

  it('an empty melody is not a dead control', () => {
    expect(octaveRoom([], 3)).toEqual({ down: 3, up: 3 });
  });

  it('reads as nothing at rest, and signed otherwise', () => {
    expect(octaveLabel(0)).toBeNull();
    expect(octaveLabel(2)).toBe('+2');
    expect(octaveLabel(-1)).toBe('-1');
  });
});
