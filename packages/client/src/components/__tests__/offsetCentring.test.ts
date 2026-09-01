/**
 * INV-NOTES-193 — the graph follows the playhead, which stays in the middle.
 */
import { offsetCentring, xForMs, type TimeAxis } from '../melodyScale';

const VIEW = 300;
const CONTENT = 1000;

/** One pixel per millisecond, so a position reads as the moment it is. */
const AXIS: TimeAxis = { t0: 0, span: 1000, pad: 0, innerW: 1000, pxPerMs: 1 };

describe('holding the playhead in the middle', () => {
  it('puts the moment half a view from the left edge', () => {
    expect(offsetCentring(500, VIEW, CONTENT)).toBe(500 - VIEW / 2);
  });

  it('moves whenever the moment does, however little', () => {
    // Unlike bringing a choice into view, which leaves it alone while it is
    // comfortable: following means holding it in one place.
    expect(offsetCentring(501, VIEW, CONTENT)).not.toBe(
      offsetCentring(500, VIEW, CONTENT)
    );
  });

  it('does not scroll before the beginning of the take', () => {
    expect(offsetCentring(10, VIEW, CONTENT)).toBe(0);
  });

  it('does not scroll past the end of it', () => {
    expect(offsetCentring(995, VIEW, CONTENT)).toBe(CONTENT - VIEW);
  });

  it('stays at nothing where the whole take already fits', () => {
    expect(offsetCentring(250, VIEW, VIEW)).toBe(0);
  });

  it('reads a moment through the same axis the head is drawn with', () => {
    // Head and view must agree, or the head is centred against a different
    // mapping from the one that placed it.
    const atMs = 400;
    expect(offsetCentring(xForMs(AXIS, atMs), VIEW, CONTENT)).toBe(
      atMs - VIEW / 2
    );
  });
});
