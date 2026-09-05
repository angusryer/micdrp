/**
 * ACC-TPORT-016 / INV-TPORT-021 — the head never jumps between readings.
 *
 * The moment and the frame stamp that dates it were two shared values,
 * written one after the other from the JS thread. A frame landing
 * between the two writes drew the new moment measured from the *old*
 * stamp — a jump forward of the whole sample interval, and a snap back
 * on the next frame. It presented as the playhead jumping a few times a
 * second, and it grew with whatever else was keeping the JS thread busy,
 * which is why it read as a problem with the graph.
 *
 * The interpolation is a worklet, so it is tested here as the pure
 * function it is rather than through a renderer that cannot run one
 * (INV-TPORT-009).
 */
import { drawnAt, readingAt } from '../headSample';

describe('a reading nothing has dated yet', () => {
  it('ACC-TPORT-016: is drawn at itself, whatever the frame clock says', () => {
    // This is the case that tore. The reading is new; the stamp that
    // would date it has not been applied. Measuring against anything
    // but the reading itself invents a jump.
    const fresh = readingAt(12000);
    expect(drawnAt(fresh, 0)).toBe(12000);
    expect(drawnAt(fresh, 900_000)).toBe(12000);
  });
});

describe('a reading a frame has dated', () => {
  it('carries forward by frame time and nothing else', () => {
    const dated = { atMs: 12000, frameMs: 5000 };
    expect(drawnAt(dated, 5000)).toBe(12000);
    expect(drawnAt(dated, 5016)).toBe(12016);
    expect(drawnAt(dated, 5200)).toBe(12200);
  });

  it('never moves backwards across a fresh reading', () => {
    // A run sampled every 200 ms, drawn every 16. The reading lands mid
    // interval and is dated by the next frame; nothing in between may
    // move the head back or fling it forward.
    let sample = readingAt(0);
    let frameMs = 0;
    let last = -1;
    for (let i = 0; i < 120; i += 1) {
      frameMs += 16;
      // A new reading arrives every 200 ms, undated, exactly as the JS
      // thread delivers it.
      if (i > 0 && i % 12 === 0) {
        sample = readingAt(frameMs);
      }
      const drawn = drawnAt(sample, frameMs);
      expect(drawn).toBeGreaterThanOrEqual(last);
      // And never further ahead than the frame clock itself has gone.
      expect(drawn).toBeLessThanOrEqual(frameMs);
      last = drawn;
      if (sample.frameMs < 0) {
        sample = { atMs: sample.atMs, frameMs };
      }
    }
  });
});
