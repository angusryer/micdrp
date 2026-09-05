/**
 * ACC-TPORT-016 / ACC-TPORT-023 — how the head moves between readings.
 *
 * Two faults, both of which presented as the playhead jumping and neither
 * of which was in the graph.
 *
 * The moment and the frame stamp that dates it were two shared values
 * written one after the other from the JS thread. A frame landing between
 * the writes drew the new moment measured against the *old* stamp — a
 * spike forward of the whole interval and a snap back next frame
 * (INV-TPORT-021).
 *
 * Then, with that fixed, the head still flicked backwards a few times a
 * second. The reading is always late: taken on the JS thread, stale by a
 * render block plus whatever that thread was busy with, while frame time
 * carried the head forward at the right rate. Moving the head to it made
 * the JS thread's lag visible as a defect in the drawing. A late reading
 * is a correction to apply, not a position to obey (INV-TPORT-029).
 *
 * The interpolation is a worklet, so it is tested here as the pure
 * function it is rather than through a renderer that cannot run one
 * (INV-TPORT-009).
 */
import { CORRECT_MS, drawnAt, firstSample, fold } from '../headSample';

describe('before anything has been read', () => {
  it('draws at the moment it was given, whatever the frame clock says', () => {
    const fresh = firstSample(12000);
    expect(drawnAt(fresh, 0)).toBe(12000);
    expect(drawnAt(fresh, 900_000)).toBe(12000);
  });
});

describe('a reading that is behind the head', () => {
  // The ordinary case: the head has been carried forward by frame time and
  // the engine's answer, taken 200 ms of JS-thread scheduling ago, is late.
  const reading = { atMs: 12000, seq: 1 };

  it('ACC-TPORT-023: does not move the head the frame it arrives', () => {
    const folded = fold(reading, 12200, 5000);
    expect(drawnAt(folded, 5000)).toBe(12200);
  });

  it('has paid the difference off one interval later', () => {
    const folded = fold(reading, 12200, 5000);
    // 200 ms of frame time later the head is where the engine said it was,
    // plus the 200 ms that have since passed — the error is gone.
    expect(drawnAt(folded, 5000 + CORRECT_MS)).toBeCloseTo(12000 + CORRECT_MS, 6);
  });

  it('INV-TPORT-030: never moves backwards while paying it off', () => {
    const folded = fold(reading, 12200, 5000);
    let last = -Infinity;
    for (let f = 5000; f <= 5000 + CORRECT_MS * 2; f += 16) {
      const drawn = drawnAt(folded, f);
      expect(drawn).toBeGreaterThanOrEqual(last);
      last = drawn;
    }
  });
});

describe('a reading that is ahead of the head', () => {
  it('catches up rather than jumping forward', () => {
    // A take located to a new moment: the engine is ahead of the drawing.
    const folded = fold({ atMs: 30000, seq: 4 }, 29900, 1000);
    expect(drawnAt(folded, 1000)).toBe(29900);
    expect(drawnAt(folded, 1000 + CORRECT_MS)).toBeCloseTo(30000 + CORRECT_MS, 6);
  });
});

describe('across a run of readings', () => {
  it('tracks the engine without ever going backwards', () => {
    // A run where every reading lands 60 ms stale, which is what the JS
    // thread actually delivers, and the head is drawn every 16 ms.
    const LAG = 60;
    let sample = firstSample(0);
    let seq = 0;
    let last = -Infinity;
    let drawn = 0;
    for (let frame = 0; frame <= 2000; frame += 16) {
      if (frame % CORRECT_MS === 0) {
        seq += 1;
        sample = fold({ atMs: Math.max(0, frame - LAG), seq }, drawn, frame);
      }
      drawn = drawnAt(sample, frame);
      expect(drawn).toBeGreaterThanOrEqual(last);
      last = drawn;
    }
    // And it has settled onto the engine's own idea of the moment rather
    // than drifting ahead of it on frame time alone. Within a frame of it,
    // not exactly on it: the frame a reading is folded in draws where the
    // previous frame did, which is what stops the head jumping at all.
    expect(Math.abs(drawn - (2000 - LAG))).toBeLessThanOrEqual(20);
  });
});
