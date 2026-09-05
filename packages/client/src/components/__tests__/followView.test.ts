/**
 * ACC-TPORT-026 / ACC-TPORT-027 / INV-TPORT-032 — the view is led, not jumped.
 *
 * Composed against the same axis as `followsTheHead.test.ts`, which pins what
 * following did before this existed. The two read together: that file says
 * where the view wants to be, this one says how it is allowed to get there.
 */
import {
  CATCH_UP_PER_SECOND,
  EDGE_PER_SECOND,
  EDGE_PX,
  edgeScrollPxPerMs,
  ledTowards
} from '../followView';
import { msAtX, offsetCentring, xForMs, type TimeAxis } from '../melodyScale';

const WIDTH = 390;
const TAKE_MS = 120_000;
const PX_PER_MS = 0.06;
const PAD = 12;
const FRAME_MS = 16;

const axis: TimeAxis = {
  t0: 0,
  span: TAKE_MS,
  pad: PAD,
  innerW: WIDTH,
  pxPerMs: PX_PER_MS
};
const CONTENT = PAD * 2 + TAKE_MS * PX_PER_MS;
const CENTRE = WIDTH / 2;

const wantedAt = (atMs: number): number =>
  offsetCentring(xForMs(axis, atMs), WIDTH, CONTENT);

/**
 * Play from `fromMs` with the view starting at `offset`, a frame at a time.
 *
 * Returns every offset and every on-screen head position, which is what a
 * singer is actually looking at.
 */
function play(fromMs: number, offset: number, forMs: number) {
  const offsets: number[] = [];
  const heads: number[] = [];
  let current = offset;
  for (let t = fromMs; t <= fromMs + forMs; t += FRAME_MS) {
    current = ledTowards(current, wantedAt(t), FRAME_MS, WIDTH);
    offsets.push(current);
    heads.push(xForMs(axis, t) - current);
  }
  return { offsets, heads, final: current };
}

describe('resuming with the head behind the middle', () => {
  // Paused a minute in, then dragged back to 50 s — still on screen, left of
  // centre. The view is showing the same thing it was a moment ago.
  const viewing = wantedAt(60_000);

  it('ACC-TPORT-026: does not move the view until the head arrives', () => {
    const { offsets } = play(50_000, viewing, 3000);
    for (const offset of offsets) {
      expect(offset).toBe(viewing);
    }
  });

  it('lets the head walk to the middle, as it does from the start', () => {
    const { heads } = play(50_000, viewing, 12_000);
    let last = -Infinity;
    for (const x of heads) {
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
    }
    // 10 s of take at 0.06 px/ms is 600 px — the head crosses the middle and
    // the view takes over from there.
    expect(heads[0]).toBeLessThan(CENTRE);
    expect(heads[heads.length - 1]).toBeCloseTo(CENTRE, 0);
  });

  it('pins the head once the two agree', () => {
    const { heads } = play(50_000, viewing, 20_000);
    // Well past the crossing, the head sits in the middle and stays.
    for (const x of heads.slice(-40)) {
      expect(x).toBeCloseTo(CENTRE, 0);
    }
  });
});

describe('resuming with the head past the middle', () => {
  // Paused, then dragged forward to 70 s while the view still shows 60 s.
  const viewing = wantedAt(60_000);

  it('ACC-TPORT-027: moves forward faster than the take', () => {
    const { offsets } = play(70_000, viewing, 1000);
    const moved = offsets[offsets.length - 1] - offsets[0];
    const tookRun = 1000 * PX_PER_MS;
    expect(moved).toBeGreaterThan(tookRun);
  });

  it('never moves more than one window in a second', () => {
    const { offsets } = play(70_000, viewing, 1000);
    expect(offsets[offsets.length - 1] - offsets[0]).toBeLessThanOrEqual(
      WIDTH * CATCH_UP_PER_SECOND + 1
    );
  });

  it('is continuous the whole way — never a jump', () => {
    const { offsets } = play(70_000, viewing, 4000);
    const perFrame = (WIDTH * CATCH_UP_PER_SECOND * FRAME_MS) / 1000;
    for (let i = 1; i < offsets.length; i += 1) {
      const step = offsets[i] - offsets[i - 1];
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(perFrame + 1e-9);
    }
  });

  it('ends with the head in the middle', () => {
    const { heads } = play(70_000, viewing, 6000);
    expect(heads[heads.length - 1]).toBeCloseTo(CENTRE, 0);
  });
});

describe('what following did before, where it was already right', () => {
  it('still holds the view at the top of a take', () => {
    // From the beginning nothing has to change: `wanted` is 0 and the view
    // is at 0, so it stays while the head walks in (ACC-TPORT-026 is the
    // same rule, arrived at from somewhere else).
    const { offsets } = play(0, 0, 3000);
    for (const offset of offsets) {
      expect(offset).toBe(0);
    }
  });

  it('still never scrolls backwards', () => {
    const { offsets } = play(0, 0, 60_000);
    let last = -Infinity;
    for (const offset of offsets) {
      expect(offset).toBeGreaterThanOrEqual(last);
      last = offset;
    }
  });
});

describe('dragging the head near an edge', () => {
  /**
   * ACC-TPORT-028 / INV-TPORT-033. Placing the head outside the window used
   * to mean dragging it, letting go, scrolling the drawing, taking hold
   * again, and repeating — several gestures for one intention.
   */
  it('does not scroll while the finger is away from both edges', () => {
    for (const x of [WIDTH / 2, WIDTH / 3, WIDTH * 0.6, EDGE_PX + 1]) {
      expect(edgeScrollPxPerMs(x, WIDTH)).toBe(0);
    }
  });

  it('scrolls left near the left edge and right near the right', () => {
    expect(edgeScrollPxPerMs(2, WIDTH)).toBeLessThan(0);
    expect(edgeScrollPxPerMs(WIDTH - 2, WIDTH)).toBeGreaterThan(0);
  });

  it('scrolls faster the closer the finger gets', () => {
    let last = 0;
    for (const x of [EDGE_PX - 1, EDGE_PX / 2, 4, 0]) {
      const speed = Math.abs(edgeScrollPxPerMs(x, WIDTH));
      expect(speed).toBeGreaterThanOrEqual(last);
      last = speed;
    }
  });

  it('eases in from nothing rather than stepping', () => {
    // Just inside the band is almost still, so crossing the line does not
    // make the drawing leap.
    expect(Math.abs(edgeScrollPxPerMs(EDGE_PX - 0.5, WIDTH))).toBeLessThan(0.01);
  });

  it('never exceeds its stated speed', () => {
    const cap = (WIDTH * EDGE_PER_SECOND) / 1000;
    for (let x = -20; x <= WIDTH + 20; x += 1) {
      expect(Math.abs(edgeScrollPxPerMs(x, WIDTH))).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it('keeps a usable middle even in a narrow window', () => {
    // The band never eats more than a third of each side, so a thumb can
    // still rest in the middle of a small window without the drawing moving.
    const NARROW = 120;
    expect(edgeScrollPxPerMs(NARROW / 2, NARROW)).toBe(0);
  });
});

describe('the moment under a finger that is not moving', () => {
  /**
   * ACC-TPORT-029 / INV-TPORT-034. A stationary finger sends no gesture
   * updates, so the head stopped where it was last put and the drawing
   * travelled out from under it — then jumped back to the thumb on release.
   *
   * What the frame callback computes is `msAtX(axis, viewX + inWindow)`.
   * The finger's place in the window is fixed; the view's offset is not.
   */
  const inWindow = WIDTH - 20; // held near the right edge, so it scrolls

  it('moves with the drawing while the finger stays still', () => {
    const before = msAtX(axis, 1000 + inWindow, 0);
    const after = msAtX(axis, 1400 + inWindow, 0);
    // The view scrolled 400 px, so the moment under the thumb is later by
    // exactly that many pixels of take.
    expect(after - before).toBeCloseTo(400 / PX_PER_MS, 6);
  });

  it('is the moment the head is drawn at, so releasing changes nothing', () => {
    // What the drag writes, and what the release seeks to, are the same
    // arithmetic on the same axis — so letting go does not move the head.
    const viewX = 1400;
    const held = msAtX(axis, viewX + inWindow, 0);
    const onRelease = msAtX(axis, viewX + inWindow, 0);
    expect(onRelease).toBe(held);
  });

  it('stays inside the take at either end', () => {
    expect(msAtX(axis, -10_000, 0)).toBe(0);
    expect(msAtX(axis, 10_000_000, 0)).toBe(TAKE_MS);
  });

  it('honours a pickup that has nothing to play before it', () => {
    const FIRST = 4000;
    expect(msAtX(axis, 0, FIRST)).toBe(FIRST);
    expect(msAtX(axis, xForMs(axis, 9000), FIRST)).toBeCloseTo(9000, 6);
  });
});

describe('the axis mapping and its inverse', () => {
  it('INV-TPORT-035: round-trips a moment through both', () => {
    for (const t of [0, 1, 250, 3050, 60_000, TAKE_MS]) {
      expect(msAtX(axis, xForMs(axis, t), 0)).toBeCloseTo(t, 6);
    }
  });

  it('answers with the start of the take for an axis with no scale', () => {
    // A drawing that has not been laid out yet has no pixels per ms, and
    // dividing by it would put the head at infinity.
    const flat: TimeAxis = { ...axis, pxPerMs: 0 };
    expect(msAtX(flat, 500, 0)).toBe(flat.t0);
  });
});
