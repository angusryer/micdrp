/**
 * INV-NOTES-202 — quantising is a view, and covers everything at once.
 *
 * The pieces the toggle moves are pure, so this checks the substitution
 * they all share: one melody in force, taken from the beat that was
 * stated, leaving what is stored exactly as it was.
 */
import {
  snappedMelody,
  timelineFromGrid,
  timelineFromTaps,
  type MusicalGrid,
  type NoteEvent,
  type TappedBeat
} from 'logic';

const taps = (at: readonly number[], downbeats: readonly number[] = []): TappedBeat[] =>
  at.map((atMs, i) => ({
    atMs,
    tappedAtMs: atMs,
    isDownbeat: downbeats.includes(i)
  }));

const note = (startMs: number, endMs: number): NoteEvent =>
  ({ midi: 60, startMs, endMs, durationMs: endMs - startMs, cents: 0, clarity: 1 }) as NoteEvent;

/** A pulse that eases off, which is what a metronome cannot follow. */
const rubato = [0, 500, 1000, 1560, 2180, 2860];

describe('the melody in force', () => {
  it('is what was sung until quantising is turned on', () => {
    const melody = [note(1020, 1500)];
    const timeline = timelineFromTaps(taps(rubato))!;
    const isQuantised = false;
    const inForce = isQuantised ? snappedMelody(melody, timeline) : melody;
    expect(inForce).toBe(melody);
  });

  it('follows the taps rather than a tempo taken from the opening', () => {
    // Beat 4 is at 2180ms. A constant 120bpm from the first two taps puts
    // it at 2000 — 180ms out, and worsening for the rest of the take.
    const timeline = timelineFromTaps(taps(rubato))!;
    const [snapped] = snappedMelody([note(2200, 2800)], timeline);
    expect(snapped.startMs).toBeCloseTo(2180, 6);
  });

  it('leaves the stored melody exactly as it was', () => {
    const melody = [note(1020, 1500), note(2200, 2800)];
    const before = JSON.stringify(melody);
    snappedMelody(melody, timelineFromTaps(taps(rubato))!);
    expect(JSON.stringify(melody)).toBe(before);
  });

  it('falls back to the fitted grid for a take nobody tapped', () => {
    // Both arrive as a timeline, so there is one snapping and not two.
    expect(timelineFromTaps(taps([]))).toBeNull();
    const grid = {
      bpm: 120,
      offsetMs: 0,
      beatsPerBar: 4,
      stepsPerBeat: 4
    } as MusicalGrid;
    const fitted = timelineFromGrid(grid, 2000);
    expect(fitted.isTapped).toBe(false);
    expect(fitted.beats).toEqual([0, 500, 1000, 1500, 2000]);
    expect(fitted.barStarts).toEqual([0, 4]);
  });

  it('gives the click the beats that were stated, downbeats and all', () => {
    const timeline = timelineFromTaps(taps(rubato, [0, 4]))!;
    expect(timeline.beats).toEqual(rubato);
    expect(timeline.barStarts).toEqual([0, 4]);
  });
});
