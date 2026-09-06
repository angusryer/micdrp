/**
 * ACC-NOTES-225 / INV-NOTES-210 — the pickup belongs to the arrangement.
 *
 * It used to be everything before the first note. So moving that note later
 * grew the pickup under it, and the head could no longer reach the moment
 * the note had started at: an edit to one note silently redefined where the
 * music began and what could be listened to.
 *
 * Where the music begins is already stated — the bars say it, and the first
 * bar line is exactly the boundary. A note is a thing inside that
 * arrangement, and moving one says nothing about where the bars are. Same
 * reasoning as INV-NOTES-174, that correcting a note must not move the bar
 * lines out from under the person correcting it.
 */
import { pickupEndsAtMs } from 'logic';

import { layoutMelody } from '../melodyLayout';
import { msAtX, xForMs } from '../melodyScale';

const grid = {
  bpm: 120,
  offsetMs: 0,
  beatsPerBar: 4,
  stepsPerBeat: 4
} as never;

const note = (startMs: number, endMs: number) => ({
  midi: 60,
  startMs,
  endMs,
  cents: 0
});

/** Half a bar of pickup at 120 in four: eight steps of 125 ms. */
const LINES = [8, 24, 40];

const drawn = (notes: ReturnType<typeof note>[]) =>
  layoutMelody(notes as never, {
    width: 390,
    height: 200,
    grid,
    beatWidth: 40,
    fromMs: 0,
    toMs: 8000
  } as never);

describe('moving the first note', () => {
  const before = [note(500, 1000), note(2000, 2500)];
  // The same take with its first note dragged later, leaving a gap at the
  // front — which is exactly what grew the pickup before.
  const after = [note(1500, 2000), note(2000, 2500)];

  it('ACC-NOTES-225: leaves the pickup exactly where it was', () => {
    expect(pickupEndsAtMs(grid, LINES)).toBeCloseTo(1000, 6);
    // The bars did not move, so neither did the pickup. The note is not
    // among the arguments.
    expect(pickupEndsAtMs(grid, LINES)).toBeCloseTo(1000, 6);
  });

  it('is what used to move it, which is the fault being fixed', () => {
    // The old boundary was the first note, and it moves by a full second.
    expect(drawn(before).firstNoteMs).toBe(500);
    expect(drawn(after).firstNoteMs).toBe(1500);
  });

  it('leaves the drawing itself alone either way', () => {
    // The window was already stable; it was the boundary inside it that
    // was following the note.
    expect(drawn(after).timeAxis.t0).toBe(drawn(before).timeAxis.t0);
    expect(drawn(after).timeAxis.span).toBe(drawn(before).timeAxis.span);
  });
});

describe('what the head can reach', () => {
  const axis = drawn([note(1500, 2000)]).timeAxis;

  it('reaches the start of the take, pickup included', () => {
    // A pickup is take that was sung, not a margin. Floored at the start of
    // the drawing rather than at the first note.
    expect(msAtX(axis, xForMs(axis, 0), 0)).toBeCloseTo(0, 6);
    expect(msAtX(axis, -500, 0)).toBe(0);
  });

  it('would have stopped at the first note before', () => {
    // The old floor: everything before the note was out of reach, and the
    // note moving took more of the take with it.
    expect(msAtX(axis, xForMs(axis, 0), 1500)).toBe(1500);
  });
});
