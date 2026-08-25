/**
 * INV-NOTES-143 — snapping is a choice, and it applies to notes as well as
 * bars.
 *
 * Bars snapped and notes did not, which was never a decision: the bar drag
 * was written against a grid and the note edits against milliseconds.
 */
import { nearestStepMs, snapNotes } from '../snapToGrid';
import type { NoteEvent } from '../segmentation';

const note = (startMs: number, endMs: number): NoteEvent =>
  ({ midi: 60, startMs, endMs, durationMs: endMs - startMs, cents: 0, clarity: 1 }) as NoteEvent;

/** A sixteenth at 120bpm is 125ms. */
const STEP = 125;

describe('the nearest moment on the grid', () => {
  it('rounds to the closer side', () => {
    expect(nearestStepMs(130, STEP)).toBe(125);
    expect(nearestStepMs(190, STEP)).toBe(250);
  });

  it('counts from the grid own offset rather than from zero', () => {
    // A grid fitted to a take rarely begins at zero, and snapping to a grid
    // that does would put every note in the wrong place by the offset.
    expect(nearestStepMs(140, STEP, 40)).toBe(165);
  });

  it('leaves a moment alone where there is no grid', () => {
    expect(nearestStepMs(137, 0)).toBe(137);
  });
});

describe('putting a note on the grid', () => {
  it('lands both edges, not only the start', () => {
    // A note that begins on the beat and ends between two is half tidied,
    // and the length is what the eye reads on a piano roll.
    const [snapped] = snapNotes([note(130, 380)], [0], STEP);
    expect(snapped.startMs).toBe(125);
    expect(snapped.endMs).toBe(375);
  });

  it('leaves a note nobody edited exactly where it was sung', () => {
    // Quantising the whole take because one note moved is an edit nobody
    // asked for.
    const notes = [note(130, 380), note(700, 900)];
    expect(snapNotes(notes, [0], STEP)[1]).toEqual(notes[1]);
  });

  it('never collapses a note to nothing', () => {
    const [snapped] = snapNotes([note(130, 150)], [0], STEP);
    expect(snapped.endMs).toBeGreaterThan(snapped.startMs);
  });

  it('never moves a note before the recording began', () => {
    const [snapped] = snapNotes([note(10, 200)], [0], STEP);
    expect(snapped.startMs).toBeGreaterThanOrEqual(0);
  });

  it('changes nothing where there is no grid to land on', () => {
    const notes = [note(130, 380)];
    expect(snapNotes(notes, [0], 0)).toEqual(notes);
  });
});
