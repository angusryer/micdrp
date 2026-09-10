/**
 * Notes written into a take — INV-NOTES-245..247.
 *
 * The merge test is the one that matters. Everything downstream is written
 * against one list of notes, and an edit is anchored by the moment it
 * covers rather than by an index (INV-NOTES-096) — so a written note that
 * sits in that list correctly needs nothing else changed at all.
 */
import { replayNoteEdits } from '../noteEdits';
import type { NoteEvent } from '../segmentation';
import { noteFromWritten, unwrite, withWritten, writeAt } from '../writtenNotes';

const sung = (startMs: number, endMs: number, midi: number): NoteEvent => ({
  midi,
  startMs,
  endMs,
  durationMs: endMs - startMs,
  cents: 0,
  clarity: 0.9,
  loudnessDb: -12
});

describe('writeAt', () => {
  it('is a quarter of the beat it sits in', () => {
    const one = writeAt(1000, 60, 600);
    expect(one.endMs - one.atMs).toBe(150);
  });

  it('is a quarter of a long beat in a take that breathes', () => {
    const one = writeAt(1000, 60, 1800);
    expect(one.endMs - one.atMs).toBe(450);
  });

  it('is short and visible where there is no beat to measure', () => {
    const one = writeAt(1000, 60, 0);
    expect(one.endMs - one.atMs).toBeGreaterThan(0);
    expect(one.endMs - one.atMs).toBeLessThan(600);
  });

  it('never starts before the take does', () => {
    expect(writeAt(-500, 60, 600).atMs).toBe(0);
  });
});

describe('noteFromWritten', () => {
  it('claims its pitch exactly, with no voice behind it', () => {
    const note = noteFromWritten({ atMs: 0, endMs: 200, midi: 60.4 });
    expect(note.midi).toBe(60);
    expect(note.cents).toBe(0);
    expect(note.isWritten).toBe(true);
  });

  it('is never zero length, whatever it was asked for', () => {
    const note = noteFromWritten({ atMs: 500, endMs: 500, midi: 60 });
    expect(note.endMs).toBeGreaterThan(note.startMs);
  });
});

describe('withWritten', () => {
  const heard = [sung(0, 400, 60), sung(1000, 1400, 64)];

  it('leaves a take with nothing written exactly as it was', () => {
    expect(withWritten(heard, [])).toEqual(heard);
  });

  it('puts a written note into the take in time order', () => {
    const all = withWritten(heard, [{ atMs: 500, endMs: 650, midi: 62 }]);
    expect(all.map((n) => n.startMs)).toEqual([0, 500, 1000]);
    expect(all.map((n) => n.isWritten === true)).toEqual([
      false,
      true,
      false
    ]);
  });

  it('lets a written note be corrected like any other', () => {
    // The whole reason for merging: an edit is anchored by the moment it
    // covers, so it finds a written note without knowing it is one.
    const all = withWritten(heard, [{ atMs: 500, endMs: 650, midi: 62 }]);
    const after = replayNoteEdits(all, [{ atMs: 520, midi: 67 }]);
    expect(after[1].midi).toBe(67);
    // And correcting it does not stop it being written (INV-NOTES-246).
    expect(after[1].isWritten).toBe(true);
  });

  it('leaves the sung notes alone when one is written over them', () => {
    const all = withWritten(heard, [{ atMs: 100, endMs: 250, midi: 62 }]);
    expect(all.filter((n) => n.isWritten !== true)).toEqual(heard);
  });
});

describe('unwrite', () => {
  const written = [
    { atMs: 500, endMs: 650, midi: 62 },
    { atMs: 900, endMs: 1050, midi: 64 }
  ];

  it('throws away the one that starts there', () => {
    expect(unwrite(written, 500).map((o) => o.atMs)).toEqual([900]);
  });

  it('leaves the rest alone', () => {
    expect(unwrite(written, 12345)).toHaveLength(2);
  });
});
