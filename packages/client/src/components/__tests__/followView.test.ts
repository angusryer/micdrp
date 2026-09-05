/**
 * ACC-TPORT-026 / ACC-TPORT-027 / INV-TPORT-032 — the view is led, not jumped.
 *
 * Composed against the same axis as `followsTheHead.test.ts`, which pins what
 * following did before this existed. The two read together: that file says
 * where the view wants to be, this one says how it is allowed to get there.
 */
import { CATCH_UP_PER_SECOND, ledTowards } from '../followView';
import { offsetCentring, xForMs, type TimeAxis } from '../melodyScale';

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
