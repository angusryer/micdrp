/**
 * INV-NOTES-177 — bringing a chosen thing into view.
 */
import { offsetShowing } from '../melodyScale';

/** A 300pt window onto 1000pt of drawing. */
const VIEW = 300;
const CONTENT = 1000;

/** Anything more than a quarter-view from the middle is brought in. */
const MARGIN = VIEW / 4;

describe('scrolling to show a point', () => {
  it('puts a point off the right into the middle', () => {
    expect(offsetShowing(600, VIEW, CONTENT, 0, MARGIN)).toBe(600 - VIEW / 2);
  });

  it('puts a point off the left into the middle', () => {
    expect(offsetShowing(100, VIEW, CONTENT, 500, MARGIN)).toBe(0);
  });

  it('leaves a point already in the middle alone', () => {
    expect(offsetShowing(150, VIEW, CONTENT, 0, MARGIN)).toBeNull();
    expect(offsetShowing(650, VIEW, CONTENT, 500, MARGIN)).toBeNull();
  });

  it('does not scroll past the end of the drawing', () => {
    expect(offsetShowing(990, VIEW, CONTENT, 0, MARGIN)).toBe(CONTENT - VIEW);
  });

  it('does not scroll before the start of it', () => {
    expect(offsetShowing(10, VIEW, CONTENT, 500, MARGIN)).toBe(0);
  });

  it('says nothing to do where the drawing all fits', () => {
    // Nowhere to scroll to: the offset can only ever be zero.
    expect(offsetShowing(280, VIEW, VIEW, 0, MARGIN)).toBeNull();
  });
});
