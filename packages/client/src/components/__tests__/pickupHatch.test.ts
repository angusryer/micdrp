/**
 * INV-NOTES-107 — the pickup is drawn as ground, and stays inside itself.
 *
 * The thing that goes wrong with a crosshatch is a line escaping the region
 * it is meant to shade — it then reads as a mark on the graph rather than as
 * the ground under one, which is the opposite of what it is for.
 *
 * Read back off the path the runtime actually wrote, through the recording
 * SkPath in jest.setup. The runtime hands out nothing to make this possible:
 * it writes straight into the path, which is what a couple of hundred faint
 * diagonals on every layout change needs it to do.
 */
import { Skia } from '@shopify/react-native-skia';

import { writePickupHatch, HATCH_SPACING } from '../pickupHatch';

const LEFT = 0;
const RIGHT = 120;
const HEIGHT = 80;

/** The recorder's log: what was written into a path, in order. */
type Command = [string, number, number];
const commandsOf = (path: unknown) =>
  (path as { commands: Command[] }).commands;

/** The strokes as pairs of points, rebuilt from the moveTo/lineTo log. */
function strokes(left = LEFT, right = RIGHT, height = HEIGHT) {
  const log = commandsOf(
    writePickupHatch(Skia.Path.Make(), left, right, height)
  );
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < log.length; i += 2) {
    const [move, x1, y1] = log[i];
    const [line, x2, y2] = log[i + 1] ?? [];
    expect(move).toBe('moveTo');
    expect(line).toBe('lineTo');
    lines.push({ x1, y1, x2, y2 });
  }
  return lines;
}

describe('the pickup crosshatch', () => {
  it('never draws outside the stretch it is shading', () => {
    for (const line of strokes()) {
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
      strokes().map((l) => Math.sign((l.y2 - l.y1) / (l.x2 - l.x1)))
    );
    expect(slopes.has(1)).toBe(true);
    expect(slopes.has(-1)).toBe(true);
  });

  it('holds still while the stretch grows around it', () => {
    // Placed on a fixed grid, so zooming shades more of the same pattern
    // rather than sliding it. A hatch that moved would read as motion.
    const key = (l: { x1: number; y1: number }) => `${l.x1}:${l.y1}`;
    const narrow = new Set(strokes(40, 90, HEIGHT).map(key));
    const wide = new Set(strokes(40, 160, HEIGHT).map(key));
    for (const drawn of narrow) {
      expect(wide.has(drawn)).toBe(true);
    }
  });

  it('spaces the lines far enough apart to read as texture', () => {
    const down = strokes().filter((l) => l.y2 > l.y1);
    // Consecutive parallels differ by one spacing along the top edge.
    const tops = down.map((l) => l.x1 - l.y1).sort((a, b) => a - b);
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1]).toBeCloseTo(HATCH_SPACING, 6);
    }
  });

  it('writes nothing at all where there is no pickup', () => {
    expect(commandsOf(writePickupHatch(Skia.Path.Make(), 50, 50, HEIGHT)))
      .toHaveLength(0);
    expect(commandsOf(writePickupHatch(Skia.Path.Make(), 0, 100, 0)))
      .toHaveLength(0);
  });
});
