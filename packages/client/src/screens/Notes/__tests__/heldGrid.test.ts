/**
 * ACC-NOTES-235 / INV-NOTES-221 — and INV-NOTES-123, which it must not break.
 *
 * The bar length reached the grid only through the tempo read from the taps,
 * and that reading needs at least two of them. So a take nobody tapped could
 * not be told it was in six-eight by any route at all.
 *
 * The ordering these guard is older and still holds: a tempo set by hand
 * beats one read from the taps, which beats the one read from the notes.
 */
import { heldGrid } from '../heldGrid';

const READ = { bpm: 100, offsetMs: 0, beatsPerBar: 4, stepsPerBeat: 4 };
const SIX_EIGHT = { beats: [1, 3, 5], beatsPerBar: 6 };
const FROM_TAPS = { bpm: 120, offsetMs: 250, beatsPerBar: 6 };

describe('ACC-NOTES-235: a bar length with no tempo behind it', () => {
  it('applies, where the taps say nothing', () => {
    const grid = heldGrid(READ, undefined, SIX_EIGHT, null);
    expect(grid.beatsPerBar).toBe(6);
  });

  it('leaves the tempo where it was read', () => {
    // Setting a bar length is not a claim about the pulse.
    const grid = heldGrid(READ, undefined, SIX_EIGHT, null);
    expect(grid.bpm).toBe(100);
    expect(grid.offsetMs).toBe(0);
  });

  it('applies under a tempo set by hand too', () => {
    const grid = heldGrid(READ, 90, SIX_EIGHT, null);
    expect(grid).toMatchObject({ bpm: 90, beatsPerBar: 6 });
  });

  it('carries the rest of the grid through untouched', () => {
    expect(heldGrid(READ, undefined, SIX_EIGHT, null).stepsPerBeat).toBe(4);
  });
});

describe('INV-NOTES-123: who has the last word', () => {
  it('a tempo set by hand beats one read from the taps', () => {
    const grid = heldGrid(READ, 90, SIX_EIGHT, FROM_TAPS);
    expect(grid.bpm).toBe(90);
  });

  it('and does not take the taps’ downbeat with it', () => {
    // By-hand sets a rate, not a place. Taking the offset would move every
    // bar line as a side effect of typing a number.
    expect(heldGrid(READ, 90, SIX_EIGHT, FROM_TAPS).offsetMs).toBe(0);
  });

  it('the taps beat the notes', () => {
    const grid = heldGrid(READ, undefined, SIX_EIGHT, FROM_TAPS);
    expect(grid).toMatchObject({ bpm: 120, offsetMs: 250, beatsPerBar: 6 });
  });

  it('and the notes stand where nobody has said anything', () => {
    expect(heldGrid(READ, undefined, undefined, null)).toEqual(READ);
  });
});

describe('a pattern and a reading that disagree about the bar', () => {
  it('takes the reading’s, because it is the one the tempo came from', () => {
    // A tempo read through a pattern already counted its bars that way;
    // using the pattern's separately would put the lines somewhere the
    // offset was not measured against.
    const grid = heldGrid(READ, undefined, { beats: [1], beatsPerBar: 3 }, FROM_TAPS);
    expect(grid.beatsPerBar).toBe(6);
  });
});
