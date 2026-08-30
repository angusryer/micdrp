/**
 * INV-NOTES-177 — where to look when something is chosen.
 */
import { chosenMomentMs } from '../chosenMoment';

const notes = [
  { midi: 60, startMs: 1000, endMs: 2000 },
  { midi: 62, startMs: 5000, endMs: 9000 }
];

describe('the moment a choice points at', () => {
  it('is the middle of a chosen note, not an edge of it', () => {
    // A long note centred on an edge would leave most of itself outside.
    expect(chosenMomentMs([{ kind: 'melodyNote', index: 1 }], notes)).toBe(7000);
  });

  it('reads a layer note the same way', () => {
    expect(chosenMomentMs([{ kind: 'layerNote', index: 0 }], notes)).toBe(1500);
  });

  it('is nothing for a set, which has no one place to look', () => {
    expect(
      chosenMomentMs(
        [
          { kind: 'melodyNote', index: 0 },
          { kind: 'melodyNote', index: 1 }
        ],
        notes
      )
    ).toBeNull();
  });

  it('is nothing when nothing is chosen', () => {
    expect(chosenMomentMs([], notes)).toBeNull();
  });

  it('is nothing for a note that is no longer there', () => {
    expect(chosenMomentMs([{ kind: 'melodyNote', index: 9 }], notes)).toBeNull();
  });
});
