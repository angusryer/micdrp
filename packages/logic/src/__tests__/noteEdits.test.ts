/**
 * Corrections to what the detector heard, kept as differences
 * (INV-NOTES-053, INV-NOTES-054).
 */
import { collectNoteEdits, moveNote, replayNoteEdits } from '../noteEdits';
import type { NoteEvent } from '../segmentation';

function n(midi: number, startMs: number, endMs: number): NoteEvent {
  return { midi, startMs, endMs, durationMs: endMs - startMs, cents: 12, clarity: 0.9 };
}

const HEARD = [n(60, 0, 500), n(64, 500, 1000), n(67, 1000, 1500)];

describe('correcting one note', () => {
  it('moves only that note', () => {
    const moved = moveNote(HEARD, 1, 1);
    expect(moved.map((x) => x.midi)).toEqual([60, 65, 67]);
    expect(moved[0]).toEqual(HEARD[0]);
    expect(moved[2]).toEqual(HEARD[2]);
  });

  it('drops the cents, which described a pitch nobody is claiming now', () => {
    expect(moveNote(HEARD, 1, 1)[1].cents).toBe(0);
  });

  it('leaves the melody alone when asked for nothing', () => {
    expect(moveNote(HEARD, 1, 0)).toEqual([...HEARD]);
    expect(moveNote(HEARD, 9, 1)).toEqual([...HEARD]);
    expect(moveNote(HEARD, -1, 1)).toEqual([...HEARD]);
  });
});

describe('keeping corrections as differences', () => {
  it('stores only what changed', () => {
    const corrected = moveNote(HEARD, 1, 1);
    const edits = collectNoteEdits(HEARD, corrected);
    expect(edits).toEqual([{ atMs: 500, midi: 65 }]);
  });

  it('round-trips', () => {
    const corrected = moveNote(HEARD, 1, 1);
    const replayed = replayNoteEdits(HEARD, collectNoteEdits(HEARD, corrected));
    expect(replayed.map((x) => x.midi)).toEqual(corrected.map((x) => x.midi));
  });

  it('stores nothing when nothing was corrected', () => {
    expect(collectNoteEdits(HEARD, [...HEARD])).toEqual([]);
    expect(replayNoteEdits(HEARD, [])).toEqual([...HEARD]);
  });

  it('drops a correction whose note has gone', () => {
    const orphan = [{ atMs: 99999, midi: 72 }];
    expect(replayNoteEdits(HEARD, orphan).map((x) => x.midi)).toEqual([60, 64, 67]);
  });

  it('applies a correction to whichever note covers its moment', () => {
    // Detection now hears the take with different boundaries, but the moment
    // still lands inside the note it was meant for.
    const reheard = [n(60, 0, 400), n(64, 400, 1100), n(67, 1100, 1500)];
    const replayed = replayNoteEdits(reheard, [{ atMs: 500, midi: 65 }]);
    expect(replayed.map((x) => x.midi)).toEqual([60, 65, 67]);
  });
});
