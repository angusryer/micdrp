/**
 * Snapping to the beat the singer stated (INV-NOTES-202).
 *
 * The interesting cases are the ones a constant tempo gets wrong: a take
 * whose pulse moves, where snapping to a metronome does not tidy the
 * performance but flattens it, and drifts further out the longer it runs.
 */
import { timelineFromTaps } from '../beatTimeline';
import { snappedMelody, snapToTimeline } from '../quantizeToTimeline';
import type { NoteEvent } from '../segmentation';
import type { TappedBeat } from '../tappedBeats';

const taps = (at: readonly number[]): TappedBeat[] =>
  at.map((atMs) => ({ atMs, tappedAtMs: atMs, isDownbeat: false }));

const note = (startMs: number, endMs: number, midi = 60): NoteEvent =>
  ({ midi, startMs, endMs, durationMs: endMs - startMs, cents: 0, clarity: 1 }) as NoteEvent;

/** Beats of 500, 500, 560, 620, 680 — a singer easing off. */
const rubato = [0, 500, 1000, 1560, 2180, 2860];

describe('snapping to a stated beat', () => {
  it('puts a note that was nearly on the beat exactly on it', () => {
    const t = timelineFromTaps(taps(rubato))!;
    const [snapped] = snapToTimeline([note(1020, 1500)], t);
    expect(snapped.snappedStartMs).toBeCloseTo(1000, 6);
    expect(snapped.deviationMs).toBeCloseTo(20, 6);
  });

  it('follows the pulse where it moved', () => {
    // Beat 4 is at 2180ms. A constant 120bpm taken from the opening would
    // put it at 2000 — 180ms out, and worsening.
    const t = timelineFromTaps(taps(rubato))!;
    const [snapped] = snapToTimeline([note(2200, 2800)], t);
    expect(snapped.snappedStartMs).toBeCloseTo(2180, 6);
    expect(snapped.startBeat).toBeCloseTo(4, 6);
  });

  it('rounds a duration as a duration, not as two ends', () => {
    // Rounding both ends independently turns a note that sat a hair either
    // side of a step into one twice or half the length it was sung at.
    const t = timelineFromTaps(taps([0, 500, 1000, 1500]))!;
    const [snapped] = snapToTimeline([note(120, 620)], t, { stepsPerBeat: 4 });
    expect(snapped.durationBeats).toBeCloseTo(1, 6);
  });

  it('never makes a note of no length', () => {
    const t = timelineFromTaps(taps([0, 500, 1000, 1500]))!;
    const [snapped] = snapToTimeline([note(100, 105)], t, { stepsPerBeat: 4 });
    expect(snapped.snappedEndMs).toBeGreaterThan(snapped.snappedStartMs);
  });

  it('leaves the notes it was given alone', () => {
    // Quantising is a view. The stored take must read the same afterwards.
    const t = timelineFromTaps(taps(rubato))!;
    const original = [note(1020, 1500)];
    const before = JSON.stringify(original);
    snapToTimeline(original, t);
    snappedMelody(original, t);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('hands back a plain melody for whatever draws or plays it', () => {
    const t = timelineFromTaps(taps(rubato))!;
    const [tidied] = snappedMelody([note(1020, 1500)], t);
    expect(tidied.startMs).toBeCloseTo(1000, 6);
    expect(tidied.durationMs).toBeCloseTo(tidied.endMs - tidied.startMs, 6);
  });

  it('has nothing to snap to without a timeline', () => {
    expect(snapToTimeline([note(0, 100)], {
      beats: [], barStarts: [], suspectGaps: [], isTapped: true
    })).toEqual([]);
  });
});
