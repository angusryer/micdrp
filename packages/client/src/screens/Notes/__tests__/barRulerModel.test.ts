/**
 * The arithmetic behind dragging a bar line — INT-NOTES-012.
 *
 * A person dragging a line is choosing two time signatures at once, and the
 * one they are not looking at is the one that surprises them. So the preview
 * is the part worth pinning down.
 */
import {
  barHandles,
  barLabels,
  previewSignatures,
  stepAtX
} from '../barRulerModel';
import type { BarLayout } from 'logic';

const SIMPLE = { stepsPerBeat: 4, isCompound: false };
const layout = (lines: number[]): BarLayout => ({ lines, ...SIMPLE });
/** 4px to a sixteenth, origin at the left edge. */
const GEOM = { originX: 0, stepWidth: 4 };

describe('barHandles', () => {
  it('puts a handle at every line', () => {
    expect(barHandles(layout([0, 16, 32]), GEOM)).toEqual([
      { lineIndex: 0, step: 0, x: 0 },
      { lineIndex: 1, step: 16, x: 64 },
      { lineIndex: 2, step: 32, x: 128 }
    ]);
  });

  it('respects an origin that is not the left edge', () => {
    expect(barHandles(layout([0]), { originX: 20, stepWidth: 4 })[0].x).toBe(20);
  });
});

describe('stepAtX', () => {
  it('snaps to the nearest step', () => {
    expect(stepAtX(64, GEOM)).toBe(16);
    expect(stepAtX(66, GEOM)).toBe(17);
    expect(stepAtX(63, GEOM)).toBe(16);
  });

  it('never goes before the take starts', () => {
    expect(stepAtX(-500, GEOM)).toBe(0);
  });

  it('survives a zero step width rather than returning nonsense', () => {
    expect(stepAtX(100, { originX: 0, stepWidth: 0 })).toBe(0);
  });
});

describe('previewSignatures', () => {
  it('shows both bars a drag is deciding', () => {
    // Dragging line 1 from step 16 back to 12: the bar before shrinks to
    // three quarters, the bar after grows to five.
    expect(previewSignatures(layout([0, 16, 32]), 48, 1, 12)).toBe('3/4 · 5/4');
  });

  it('shows the odd metres a drag can produce', () => {
    expect(previewSignatures(layout([0, 16, 32]), 48, 1, 14)).toBe('7/8 · 9/8');
  });

  it('clamps to where the line can actually land, not where the finger is', () => {
    // Dragged past its neighbour: the readout must promise what will happen.
    const past = previewSignatures(layout([0, 16, 32]), 48, 1, 99);
    expect(past).toBe(previewSignatures(layout([0, 16, 32]), 48, 1, 31));
  });

  it('never shows a bar of nothing', () => {
    expect(previewSignatures(layout([0, 16, 32]), 48, 1, 0)).not.toMatch(/(^|\W)0\//);
  });

  it('shows one signature for the first line of a take with no pickup', () => {
    expect(previewSignatures(layout([0, 16]), 32, 0, 0)).toBe('4/4');
  });

  it('is empty for a line that does not exist', () => {
    expect(previewSignatures(layout([0, 16]), 32, 7, 4)).toBe('');
  });

  it('uses the take end as the upper bound for the last line', () => {
    expect(previewSignatures(layout([0, 16]), 48, 1, 20)).toBe('5/4 · 7/4');
  });
});

describe('barLabels', () => {
  it('numbers the bars and names their signatures', () => {
    expect(barLabels(layout([0, 16]), 32)).toEqual(['1 · 4/4', '2 · 4/4']);
  });

  it('calls the incomplete bar before the first line a pickup', () => {
    expect(barLabels(layout([8, 24]), 40)[0]).toBe('pickup 2/4');
  });
});
