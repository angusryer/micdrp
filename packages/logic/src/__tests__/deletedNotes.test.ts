/**
 * Throwing a note away — INV-NOTES-248 and INV-NOTES-249.
 *
 * The correction tests are the point. A deletion cannot be an edit: edits
 * are collected note against note in order, so a missing note shifts every
 * anchor after it and collecting them again would rewrite every later
 * correction onto the wrong note.
 */
import { collectNoteEdits, replayNoteEdits } from '../noteEdits';
import type { NoteEvent } from '../segmentation';
import { anchorOf, withWritten, withoutDeleted } from '../writtenNotes';

const sung = (startMs: number, endMs: number, midi: number): NoteEvent => ({
  midi,
  startMs,
  endMs,
  durationMs: endMs - startMs,
  cents: 0,
  clarity: 0.9,
  loudnessDb: -12
});

const heard = [sung(0, 400, 60), sung(500, 900, 62), sung(1000, 1400, 64)];

describe('withoutDeleted', () => {
  it('leaves a take with nothing thrown away exactly as it was', () => {
    expect(withoutDeleted(heard, [])).toEqual(heard);
  });

  it('leaves out the note the anchor falls inside', () => {
    const left = withoutDeleted(heard, [anchorOf(heard[1])]);
    expect(left.map((n) => n.midi)).toEqual([60, 64]);
  });

  it('finds the same note when a re-read moves its onset', () => {
    // The whole reason the anchor is a moment inside the note rather than
    // its exact start: a fixed instant would let it back in.
    const again = [sung(0, 400, 60), sung(480, 890, 62), sung(1000, 1400, 64)];
    expect(withoutDeleted(again, [500]).map((n) => n.midi)).toEqual([60, 64]);
  });

  it('throws away nothing for an anchor inside no note', () => {
    expect(withoutDeleted(heard, [450])).toHaveLength(3);
  });

  it('throws away a written note like any other', () => {
    const all = withWritten(heard, [{ atMs: 1500, endMs: 1650, midi: 67 }]);
    expect(withoutDeleted(all, [1500])).toHaveLength(3);
  });
});

describe('a deletion beside a correction', () => {
  it('leaves the corrections around it alone', () => {
    // Two notes corrected, then the one between them thrown away. The
    // edits are anchored to moments that did not move, so both survive.
    const corrected = [
      { ...heard[0], midi: 61 },
      heard[1],
      { ...heard[2], midi: 65 }
    ];
    const edits = collectNoteEdits(heard, corrected);
    const left = withoutDeleted(heard, [anchorOf(heard[1])]);
    const after = replayNoteEdits(left, edits);
    expect(after.map((n) => n.midi)).toEqual([61, 65]);
  });

  it('brings a note back with the correction it had', () => {
    const corrected = [heard[0], { ...heard[1], midi: 63 }, heard[2]];
    const edits = collectNoteEdits(heard, corrected);
    // Thrown away, then put back: the edit never went anywhere.
    const gone = replayNoteEdits(withoutDeleted(heard, [500]), edits);
    expect(gone.map((n) => n.midi)).toEqual([60, 64]);
    const back = replayNoteEdits(withoutDeleted(heard, []), edits);
    expect(back.map((n) => n.midi)).toEqual([60, 63, 64]);
  });
});
