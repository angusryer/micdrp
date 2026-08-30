/**
 * INV-NOTES-178, INV-NOTES-179 — the rules of a stretch to listen back to.
 */
import {
  LEAD_IN_MS,
  LEAD_OUT_MS,
  MIN_RANGE_MS,
  isWithin,
  moveEdge,
  rangeAround,
  rangeLengthMs
} from '../playRange';

const TAKE = { startMs: 0, endMs: 30000 };

describe('marking out a stretch around something', () => {
  it('leaves room either side of it', () => {
    const range = rangeAround(5000, 6000, TAKE);
    expect(range).toEqual({
      fromMs: 5000 - LEAD_IN_MS,
      toMs: 6000 + LEAD_OUT_MS
    });
  });

  it('holds the thing it was marked around', () => {
    const range = rangeAround(5000, 6000, TAKE)!;
    expect(isWithin(range, 5000)).toBe(true);
    expect(isWithin(range, 6000)).toBe(true);
  });

  it('stops at the start of the take rather than before it', () => {
    const range = rangeAround(100, 300, TAKE)!;
    expect(range.fromMs).toBe(0);
    expect(range.toMs).toBe(300 + LEAD_OUT_MS);
  });

  it('stops at the end of the take rather than after it', () => {
    const range = rangeAround(29800, 29900, TAKE)!;
    expect(range.toMs).toBe(30000);
    expect(rangeLengthMs(range)).toBeGreaterThanOrEqual(MIN_RANGE_MS);
  });

  it('reads the two moments in either order', () => {
    expect(rangeAround(6000, 5000, TAKE)).toEqual(rangeAround(5000, 6000, TAKE));
  });

  it('says so when there is not enough to play', () => {
    expect(rangeAround(0, 10, { startMs: 0, endMs: 50 })).toBeNull();
  });
});

describe('moving one end of a stretch', () => {
  const range = { fromMs: 4000, toMs: 8000 };

  it('leaves the other end where it was', () => {
    expect(moveEdge(range, 'from', 5000, TAKE)).toEqual({
      fromMs: 5000,
      toMs: 8000
    });
    expect(moveEdge(range, 'to', 9000, TAKE)).toEqual({
      fromMs: 4000,
      toMs: 9000
    });
  });

  it('stops each end against its opposite rather than pushing it', () => {
    // Dragged well past the far end. It stops short of it by the shortest
    // stretch worth playing, and the far end has not moved.
    const squashed = moveEdge(range, 'from', 12000, TAKE);
    expect(squashed.toMs).toBe(8000);
    expect(squashed.fromMs).toBe(8000 - MIN_RANGE_MS);

    const other = moveEdge(range, 'to', 0, TAKE);
    expect(other.fromMs).toBe(4000);
    expect(other.toMs).toBe(4000 + MIN_RANGE_MS);
  });

  it('stops at the ends of the take', () => {
    expect(moveEdge(range, 'from', -5000, TAKE).fromMs).toBe(0);
    expect(moveEdge(range, 'to', 99000, TAKE).toMs).toBe(30000);
  });
});
