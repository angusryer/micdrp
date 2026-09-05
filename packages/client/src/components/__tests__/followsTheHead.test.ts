/**
 * How the view follows the head — the behaviour as it stands, before it is
 * changed.
 *
 * The playhead is drawn at a fixed place on the drawing and the *view* moves
 * under it, so what a singer actually sees is the difference between the two:
 * `headOnScreen = xForMs(axis, atMs) - offset`. That composition lives in
 * `ZoomableMelody`'s follow reaction, spread across a worklet and a
 * `scrollTo`, where no test can reach it. It is composed here exactly as that
 * reaction composes it, so the behaviour is pinned even though the reaction
 * is not.
 *
 * Written before touching any of it. Resuming from a dragged moment currently
 * snaps the view, and fixing that means changing what follows — so what is
 * right today needs to be written down first, or the fix takes the good parts
 * with it.
 */
import { offsetCentring, xForMs, type TimeAxis } from '../melodyScale';

/** A phone-width window onto a two-minute take, zoomed so it scrolls. */
const WIDTH = 390;
const TAKE_MS = 120_000;
const PX_PER_MS = 0.06; // 60 px a second
const PAD = 12;

const axis: TimeAxis = {
  t0: 0,
  span: TAKE_MS,
  pad: PAD,
  innerW: WIDTH,
  pxPerMs: PX_PER_MS
};

/** The drawing is as wide as the take plus the padding either side. */
const CONTENT = PAD * 2 + TAKE_MS * PX_PER_MS;

/** Where the view sits when following the head at `atMs`. */
const offsetAt = (atMs: number, contentWidth = CONTENT): number =>
  offsetCentring(xForMs(axis, atMs), WIDTH, contentWidth);

/** Where the head appears on screen when the view is following it. */
const headOnScreen = (atMs: number, contentWidth = CONTENT): number =>
  xForMs(axis, atMs) - offsetAt(atMs, contentWidth);

/** Every 100 ms of a take, which is finer than the eye and than a frame. */
const through = (fromMs: number, toMs: number): number[] => {
  const out: number[] = [];
  for (let t = fromMs; t <= toMs; t += 100) {
    out.push(t);
  }
  return out;
};

const CENTRE = WIDTH / 2;

describe('starting from the beginning of a take', () => {
  it('holds the view still until the head reaches the middle', () => {
    // The take begins at the left edge and the head walks in to meet the
    // centre. Scrolling before then would push the beginning of the take off
    // the screen to show empty space in front of it.
    for (const t of through(0, 2000)) {
      expect(offsetAt(t)).toBe(0);
    }
  });

  it('walks the head from the left edge to the middle', () => {
    expect(headOnScreen(0)).toBe(PAD);
    let last = -Infinity;
    for (const t of through(0, 3000)) {
      const x = headOnScreen(t);
      expect(x).toBeGreaterThanOrEqual(last);
      expect(x).toBeLessThanOrEqual(CENTRE);
      last = x;
    }
    // (CENTRE - PAD) / PX_PER_MS = 3050 ms in, the head is at the middle.
    expect(headOnScreen(3050)).toBeCloseTo(CENTRE, 6);
  });
});

describe('once the head is in the middle', () => {
  it('pins the head and moves the view instead', () => {
    for (const t of through(4000, 100_000)) {
      expect(headOnScreen(t)).toBeCloseTo(CENTRE, 6);
    }
  });

  it('scrolls forward and never backwards', () => {
    let last = -Infinity;
    for (const t of through(0, TAKE_MS)) {
      const offset = offsetAt(t);
      expect(offset).toBeGreaterThanOrEqual(last);
      last = offset;
    }
  });
});

describe('reaching the end of a take', () => {
  it('stops the view and lets the head walk to the right edge', () => {
    const furthest = CONTENT - WIDTH;
    // Past this moment there is nothing further to scroll to.
    const lastScrollMs = (furthest + CENTRE - PAD) / PX_PER_MS;
    for (const t of through(Math.ceil(lastScrollMs) + 100, TAKE_MS)) {
      expect(offsetAt(t)).toBeCloseTo(furthest, 6);
    }
    let last = -Infinity;
    for (const t of through(Math.ceil(lastScrollMs), TAKE_MS)) {
      const x = headOnScreen(t);
      expect(x).toBeGreaterThanOrEqual(last);
      expect(x).toBeLessThanOrEqual(WIDTH);
      last = x;
    }
  });
});

describe('a take that fits the window', () => {
  // Zoomed out far enough that the whole take is in view, there is nowhere
  // to scroll: the head crosses a still drawing (INV-TPORT-023).
  const FITS = WIDTH - 40;

  it('never moves the view', () => {
    for (const t of through(0, TAKE_MS)) {
      expect(offsetAt(t, FITS)).toBe(0);
    }
  });

  it('walks the head the whole way across', () => {
    let last = -Infinity;
    for (const t of through(0, TAKE_MS)) {
      const x = headOnScreen(t, FITS);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
  });
});

describe('resuming from a moment that was dragged to', () => {
  /**
   * What happens today, written down because it is what is about to change.
   *
   * The view is placed by the moment alone, with no memory of where it was.
   * So pressing play after dragging the head puts the view wherever that
   * moment centres — which, from anywhere past the opening seconds, is a jump
   * the eye cannot follow. From a moment inside the opening seconds it is a
   * jump back to the very start.
   */
  it('places the view by the moment alone, wherever the view had been', () => {
    // Dragged to a minute in and played: the view is centred there at once,
    // whatever it was showing a frame earlier.
    const wanted = offsetAt(60_000);
    expect(wanted).toBeCloseTo(xForMs(axis, 60_000) - CENTRE, 6);
    // And the head is immediately at the middle rather than travelling to it.
    expect(headOnScreen(60_000)).toBeCloseTo(CENTRE, 6);
  });

  it('snaps back to the start for a moment inside the opening seconds', () => {
    // The same rule, at the other end of its range: under 3050 ms the
    // centring clamps to zero, so the view returns to the top of the take.
    expect(offsetAt(1000)).toBe(0);
    expect(headOnScreen(1000)).toBeLessThan(CENTRE);
  });
});
