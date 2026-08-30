/**
 * INV-NOTES-173 — a short note is no harder to hit than a long one.
 *
 * Notes were hit-tested with reach vertically and none horizontally, so a
 * whistled note a few pixels wide was a hairline. A tapped beat claims a fixed
 * distance either side of itself across the whole height, so every short note
 * near a beat was unselectable: the touch missed the note by two pixels and
 * the beat took it.
 */
import { selectionAt } from '../graphHitTest';
import type { BeatLine } from '../graphSelection';
import type { NoteRect } from '../melodyLayout';

/** A note of a given width, centred vertically on cy. */
const note = (x: number, cy: number, width: number): NoteRect => ({
  x,
  y: cy - 3,
  width,
  height: 6,
  cy,
  midi: 62
});

const beat = (index: number, x: number): BeatLine => ({ index, x });

describe('reaching a small note', () => {
  it('names a one-pixel note from a few pixels to the side', () => {
    const found = selectionAt(106, 50, [], [], [note(100, 50, 1)]);
    expect(found).toEqual({ kind: 'melodyNote', index: 0 });
  });

  it('still finds nothing far from any note', () => {
    // Reach, not a claim on the whole graph.
    const found = selectionAt(140, 50, [], [], [note(100, 50, 1)]);
    expect(found).toBeNull();
  });

  it('takes the nearer of two short notes side by side', () => {
    const found = selectionAt(
      118,
      50,
      [],
      [],
      [note(100, 50, 2), note(120, 50, 2)]
    );
    expect(found).toEqual({ kind: 'melodyNote', index: 1 });
  });
});

describe('a short note beside a beat', () => {
  it('means the note when the touch is inside it', () => {
    // Inside beats near: the beat is a pixel away, but the finger is on the
    // note, and a person aims at what they can see.
    const found = selectionAt(
      101,
      50,
      [],
      [],
      [note(100, 50, 4)],
      [],
      [],
      [beat(0, 103)]
    );
    expect(found).toEqual({ kind: 'melodyNote', index: 0 });
  });

  it('means the line when the touch is on the line', () => {
    // Reach must not make a note swallow the line beside it.
    const found = selectionAt(
      120,
      50,
      [],
      [],
      [note(100, 50, 4)],
      [],
      [],
      [beat(0, 120)]
    );
    expect(found).toEqual({ kind: 'beat', index: 0 });
  });

  it('means whichever is closer when the touch is outside both', () => {
    const nearerNote = selectionAt(
      107,
      50,
      [],
      [],
      [note(100, 50, 4)],
      [],
      [],
      [beat(0, 116)]
    );
    expect(nearerNote).toEqual({ kind: 'melodyNote', index: 0 });

    const nearerBeat = selectionAt(
      112,
      50,
      [],
      [],
      [note(100, 50, 4)],
      [],
      [],
      [beat(0, 116)]
    );
    expect(nearerBeat).toEqual({ kind: 'beat', index: 0 });
  });

  it('measures the note from its body, not from its centre', () => {
    // A long note under the finger must not lose to a beat merely because the
    // note is drawn wide and its middle is far away.
    const found = selectionAt(
      200,
      50,
      [],
      [],
      [note(100, 50, 200)],
      [],
      [],
      [beat(0, 203)]
    );
    expect(found).toEqual({ kind: 'melodyNote', index: 0 });
  });
});
