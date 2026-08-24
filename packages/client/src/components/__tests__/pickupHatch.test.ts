/**
 * INV-NOTES-107 — the pickup is drawn as ground, and stays inside itself.
 *
 * The thing that goes wrong with a crosshatch is a line escaping the region
 * it is meant to shade — it then reads as a mark on the graph rather than as
 * the ground under one, which is the opposite of what it is for.
 */
import { hatchSegments, HATCH_SPACING } from '../pickupHatch';

const LEFT = 0;
const RIGHT = 120;
const HEIGHT = 80;

const hatch = () => hatchSegments(LEFT, RIGHT, HEIGHT);

describe('the pickup crosshatch', () => {
  it('never draws outside the stretch it is shading', () => {
    for (const line of hatch()) {
      for (const [x, y] of [
        [line.x1, line.y1],
        [line.x2, line.y2]
      ]) {
        expect(x).toBeGreaterThanOrEqual(LEFT);
        expect(x).toBeLessThanOrEqual(RIGHT);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(HEIGHT);
      }
    }
  });

  it('crosses itself, rather than running one way only', () => {
    const slopes = new Set(
      hatch().map((l) => Math.sign((l.y2 - l.y1) / (l.x2 - l.x1)))
    );
    expect(slopes.has(1)).toBe(true);
    expect(slopes.has(-1)).toBe(true);
  });

  it('holds still while the stretch grows around it', () => {
    // Placed on a fixed grid, so zooming shades more of the same pattern
    // rather than sliding it. A hatch that moved would read as motion.
    const narrow = hatchSegments(40, 90, HEIGHT);
    const wide = hatchSegments(40, 160, HEIGHT);
    const key = (l: { x1: number; y1: number }) => `${l.x1}:${l.y1}`;
    const inNarrow = new Set(narrow.map(key));
    // Every line the narrow box drew is still drawn by the wide one.
    const kept = [...inNarrow].filter((k) => wide.some((l) => key(l) === k));
    expect(kept.length).toBe(inNarrow.size);
  });

  it('spaces the lines far enough apart to read as texture', () => {
    const down = hatch().filter((l) => l.y2 > l.y1);
    // Consecutive parallels differ by one spacing along the top edge.
    const tops = down.map((l) => l.x1 - l.y1).sort((a, b) => a - b);
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1]).toBeCloseTo(HATCH_SPACING, 6);
    }
  });

  it('draws nothing where there is no pickup', () => {
    expect(hatchSegments(50, 50, HEIGHT)).toEqual([]);
    expect(hatchSegments(0, 100, 0)).toEqual([]);
  });
});
