/**
 * INV-NOTES-118 — a struck sound and a layer note can be chosen.
 *
 * The graph could point at three kinds of thing and the take contains five.
 * Two of them — the drums, and the second take sung under the first — were
 * drawn and could not be touched, which makes them decoration rather than
 * part of the reading.
 *
 * One surface still reads every touch (INT-NOTES-015). What changes is what
 * it knows to look for.
 */
import { selectionAt } from '../graphHitTest';
import type { HitPoint } from '../graphSelection';
import type { NoteRect } from '../melodyLayout';

const note = (x: number, cy: number): NoteRect => ({
  x,
  y: cy - 3,
  width: 40,
  height: 6,
  cy,
  midi: 62
});

const hitAt = (index: number, x: number, y: number): HitPoint => ({
  index,
  x,
  y
});

describe('choosing what a touch means', () => {
  it('finds a struck sound in the band below the drawing', () => {
    const found = selectionAt(100, 210, [], [], [], [], [hitAt(0, 100, 210)]);
    expect(found).toEqual({ kind: 'hit', index: 0 });
  });

  it('takes the nearest struck sound when two are close', () => {
    const found = selectionAt(
      104,
      210,
      [],
      [],
      [],
      [],
      [hitAt(0, 90, 210), hitAt(1, 106, 210)]
    );
    expect(found).toEqual({ kind: 'hit', index: 1 });
  });

  it('finds a layer note where nothing was sung over it', () => {
    const found = selectionAt(110, 50, [], [], [], [note(100, 50)], []);
    expect(found).toEqual({ kind: 'layerNote', index: 0 });
  });

  it('prefers the sung line where both are under the touch', () => {
    // The layer is drawn behind, so a touch that could mean either means the
    // one in front.
    const found = selectionAt(110, 50, [], [], [note(100, 50)], [note(100, 50)]);
    expect(found).toEqual({ kind: 'melodyNote', index: 0 });
  });

  it('means nothing where the touch is in neither', () => {
    expect(selectionAt(400, 400, [], [], [], [note(100, 50)], [hitAt(0, 10, 10)]))
      .toBeNull();
  });

  it('still means nothing at all on an empty graph', () => {
    expect(selectionAt(10, 10, [], [], [], [], [])).toBeNull();
  });
});
