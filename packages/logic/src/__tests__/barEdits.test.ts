/**
 * Changing an arrangement of bars — INV-TRANS-012, INV-TRANS-014.
 *
 * The premise is that a person corrects how a take is written down and never
 * what they sang. So the properties that matter are structural: lines stay
 * ordered, bars keep tiling the take, and the total length never moves.
 */
import {
  addBarLine,
  moveBarLine,
  readBars,
  removeBarLine,
  type BarLayout
} from '../index';

const SIMPLE = { stepsPerBeat: 4, isCompound: false };
const layout = (lines: number[]): BarLayout => ({ lines, ...SIMPLE });

/** Ascending, no repeats — what every operation must leave behind. */
function isWellFormed(l: BarLayout): boolean {
  const lines = [...l.lines];
  const unique = new Set(lines).size === lines.length;
  const ascending = lines.every((s, i) => i === 0 || s > lines[i - 1]);
  return unique && ascending;
}

describe('moveBarLine', () => {
  it('lengthens one bar and shortens its neighbour', () => {
    // The whole gesture: drag a line back a step, the bar to its left loses
    // that step and the bar to its right gains it.
    const moved = moveBarLine(layout([0, 16, 32]), 1, 12);
    const bars = readBars(moved, 48);
    expect(bars.map((b) => b.steps)).toEqual([12, 20, 16]);
  });

  it('INV-TRANS-012: the take is exactly as long afterwards', () => {
    const before = readBars(layout([0, 16, 32]), 48);
    const after = readBars(moveBarLine(layout([0, 16, 32]), 1, 9), 48);
    const total = (bars: { steps: number }[]) => bars.reduce((n, b) => n + b.steps, 0);
    expect(total(after)).toBe(total(before));
  });

  it('refuses to cross the line before it', () => {
    const l = layout([0, 16, 32]);
    expect(moveBarLine(l, 1, 0).lines).toEqual([0, 16, 32]);
    expect(moveBarLine(l, 1, -4).lines).toEqual([0, 16, 32]);
  });

  it('refuses to cross the line after it', () => {
    expect(moveBarLine(layout([0, 16, 32]), 1, 32).lines).toEqual([0, 16, 32]);
    expect(moveBarLine(layout([0, 16, 32]), 1, 40).lines).toEqual([0, 16, 32]);
  });

  it('refuses to land on a neighbour rather than collapsing a bar', () => {
    // A bar of no length is not something a person can have meant, so the
    // gesture stops at the edge instead of doing something surprising.
    expect(moveBarLine(layout([0, 8]), 1, 8).lines).toEqual([0, 8]);
  });

  it('moves the last line freely, since nothing bounds it above', () => {
    expect(moveBarLine(layout([0, 16]), 1, 40).lines).toEqual([0, 40]);
  });

  it('changes nothing when moved to where it already is', () => {
    expect(moveBarLine(layout([0, 16]), 1, 16).lines).toEqual([0, 16]);
  });

  it('ignores a line that does not exist', () => {
    expect(moveBarLine(layout([0, 16]), 9, 4).lines).toEqual([0, 16]);
  });
});

describe('addBarLine', () => {
  it('splits a bar in two', () => {
    const bars = readBars(addBarLine(layout([0, 16]), 8), 32);
    expect(bars.map((b) => b.steps)).toEqual([8, 8, 16]);
  });

  it('reaches arrangements that moving alone cannot', () => {
    // Four bars of four cannot become five of three by dragging: the number
    // of bars is fixed until a line is added.
    let l = layout([0, 16, 32, 48]);
    for (const step of [12, 24, 36]) {
      l = addBarLine(l, step);
    }
    expect(l.lines.length).toBe(7);
  });

  it('changes nothing where a line already is', () => {
    expect(addBarLine(layout([0, 16]), 16).lines).toEqual([0, 16]);
  });

  it('refuses a step before the take begins', () => {
    expect(addBarLine(layout([0, 16]), -4).lines).toEqual([0, 16]);
  });

  it('keeps lines in order however they arrive', () => {
    expect(addBarLine(layout([0, 32]), 16).lines).toEqual([0, 16, 32]);
  });
});

describe('removeBarLine', () => {
  it('merges the two bars either side', () => {
    const bars = readBars(removeBarLine(layout([0, 8, 16]), 1), 32);
    expect(bars.map((b) => b.steps)).toEqual([16, 16]);
  });

  it('refuses to remove the only line', () => {
    // A take with no lines has no bars, and nothing downstream can say
    // anything about it.
    expect(removeBarLine(layout([0]), 0).lines).toEqual([0]);
  });

  it('ignores a line that does not exist', () => {
    expect(removeBarLine(layout([0, 16]), 5).lines).toEqual([0, 16]);
  });
});

describe('INV-TRANS-014: any sequence of edits leaves a usable arrangement', () => {
  it('holds across a long run of moves, adds and removes', () => {
    let l = layout([0, 16, 32, 48]);
    // Deterministic rather than random, so a failure is reproducible.
    const seed = [7, 3, 11, 2, 19, 5, 13, 1, 23, 17];
    for (let i = 0; i < 60; i++) {
      const n = seed[i % seed.length] * (i + 1);
      if (i % 3 === 0) {
        l = moveBarLine(l, n % Math.max(1, l.lines.length), n % 64);
      } else if (i % 3 === 1) {
        l = addBarLine(l, n % 64);
      } else {
        l = removeBarLine(l, n % Math.max(1, l.lines.length));
      }
      expect(isWellFormed(l)).toBe(true);
      expect(l.lines.length).toBeGreaterThanOrEqual(1);

      const bars = readBars(l, 64);
      let expected = 0;
      for (const bar of bars) {
        expect(bar.steps).toBeGreaterThan(0);
        expect(bar.startStep).toBe(expected);
        expected += bar.steps;
      }
      expect(expected).toBe(64);
    }
  });
});
