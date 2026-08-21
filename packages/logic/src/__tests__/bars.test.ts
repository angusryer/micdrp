/**
 * Bars as an arrangement rather than an inference —
 * INV-TRANS-012, INV-TRANS-013, INV-TRANS-014.
 *
 * Detected metre scores 0.17 over real takes against a threshold of 0.25, so
 * most of them fall back to 4/4 and admit it. These pin the model that
 * replaces guessing harder with letting someone say.
 */
import {
  proposeBars,
  readBars,
  stepAtMs,
  timeSignatureOf,
  type BarLayout
} from '../index';

/** Simple metre: the beat is a quarter, so a step is a sixteenth. */
const SIMPLE = { stepsPerBeat: 4, isCompound: false };
/** Compound: the beat is a dotted quarter, six steps to it. */
const COMPOUND = { stepsPerBeat: 6, isCompound: true };

const layout = (lines: number[], m = SIMPLE): BarLayout => ({ lines, ...m });

describe('timeSignatureOf', () => {
  it('writes whole quarters as quarters', () => {
    expect(timeSignatureOf(16, 4, false)).toBe('4/4');
    expect(timeSignatureOf(12, 4, false)).toBe('3/4');
    expect(timeSignatureOf(8, 4, false)).toBe('2/4');
  });

  it('INV-TRANS-013: writes the odd metres a singer can actually perform', () => {
    // The ones that a beats-based model cannot express at all.
    expect(timeSignatureOf(28, 4, false)).toBe('7/4');
    expect(timeSignatureOf(44, 4, false)).toBe('11/4');
    expect(timeSignatureOf(52, 4, false)).toBe('13/4');
    expect(timeSignatureOf(14, 4, false)).toBe('7/8');
    expect(timeSignatureOf(26, 4, false)).toBe('13/8');
    expect(timeSignatureOf(30, 4, false)).toBe('15/8');
    expect(timeSignatureOf(10, 4, false)).toBe('5/8');
  });

  it('falls to sixteenths when a bar divides no coarser', () => {
    expect(timeSignatureOf(13, 4, false)).toBe('13/16');
    expect(timeSignatureOf(7, 4, false)).toBe('7/16');
  });

  it('writes compound metre in eighths, not quarters', () => {
    // Six eighths and three quarters are the same length and different
    // feels; arithmetic alone cannot choose between them.
    expect(timeSignatureOf(12, 6, true)).toBe('6/8');
    expect(timeSignatureOf(18, 6, true)).toBe('9/8');
    expect(timeSignatureOf(24, 6, true)).toBe('12/8');
    expect(timeSignatureOf(30, 6, true)).toBe('15/8');
  });

  it('never falls back to a default the way detected metre did', () => {
    for (let steps = 1; steps <= 64; steps++) {
      expect(timeSignatureOf(steps, 4, false)).toMatch(/^\d+\/\d+$/);
    }
  });
});

describe('readBars', () => {
  it('reads a bar from each line to the next', () => {
    const bars = readBars(layout([0, 16, 32]), 48);
    expect(bars.map((b) => b.steps)).toEqual([16, 16, 16]);
    expect(bars.map((b) => b.timeSignature)).toEqual(['4/4', '4/4', '4/4']);
  });

  it('runs the last bar to the end of the take', () => {
    const bars = readBars(layout([0, 16]), 40);
    expect(bars[1].steps).toBe(24);
  });

  it('numbers bars from one', () => {
    expect(readBars(layout([0, 16]), 32).map((b) => b.index)).toEqual([1, 2]);
  });

  it('treats steps before the first line as a pickup, numbered zero', () => {
    // Singers start mid-bar constantly. Calling that bar one would put
    // every downbeat after it in the wrong place.
    const bars = readBars(layout([8, 24]), 40);
    expect(bars[0]).toMatchObject({ index: 0, steps: 8, isPickup: true });
    expect(bars[1]).toMatchObject({ index: 1, isPickup: false });
  });

  it('has no pickup when the take starts on a downbeat', () => {
    expect(readBars(layout([0, 16]), 32).some((b) => b.isPickup)).toBe(false);
  });

  it('INV-TRANS-014: bars tile the take with no gap and no overlap', () => {
    const bars = readBars(layout([6, 20, 33]), 50);
    let expected = 0;
    for (const bar of bars) {
      expect(bar.startStep).toBe(expected);
      expected += bar.steps;
    }
    expect(expected).toBe(50);
  });

  it('reads nothing from a layout with no lines', () => {
    expect(readBars(layout([]), 32)).toEqual([]);
  });

  it('ignores a line past the end of the take', () => {
    expect(readBars(layout([0, 16, 999]), 32)).toHaveLength(2);
  });
});

describe('proposeBars', () => {
  it('spaces lines by the grid it was given', () => {
    expect(proposeBars(4, 4, false, 48).lines).toEqual([0, 16, 32]);
    expect(proposeBars(3, 4, false, 36).lines).toEqual([0, 12, 24]);
  });

  it('covers the whole take', () => {
    const { lines } = proposeBars(4, 4, false, 50);
    expect(lines[lines.length - 1]).toBeLessThan(50);
  });

  it('gives a take shorter than one bar a single bar, not none', () => {
    expect(proposeBars(4, 4, false, 5).lines).toEqual([0]);
    expect(proposeBars(4, 4, false, 0).lines).toEqual([0]);
  });

  it('carries the metre through for later rendering', () => {
    expect(proposeBars(2, 6, true, 24)).toMatchObject(COMPOUND);
  });
});

describe('stepAtMs', () => {
  it('finds the step a time lands on', () => {
    // 120bpm: a beat is 500ms, so a sixteenth is 125ms.
    expect(stepAtMs(0, 0, 500, 4)).toBe(0);
    expect(stepAtMs(500, 0, 500, 4)).toBe(4);
    expect(stepAtMs(125, 0, 500, 4)).toBe(1);
  });

  it('snaps to the nearest step rather than the one before', () => {
    expect(stepAtMs(130, 0, 500, 4)).toBe(1);
    expect(stepAtMs(190, 0, 500, 4)).toBe(2);
  });

  it('respects the grid phase, since takes never start at zero', () => {
    expect(stepAtMs(700, 200, 500, 4)).toBe(4);
  });

  it('never goes below the start of the take', () => {
    expect(stepAtMs(-999, 0, 500, 4)).toBe(0);
  });
});
