/**
 * Where the scrub handle sits (INV-NOTES-206, INV-NOTES-207).
 *
 * The arithmetic is testable; the thing it exists to prevent is not. No
 * test in this repo can run a worklet, so a plain function called from an
 * animated style passes every check here and crashes a device natively.
 * What this can do is keep the sums honest and keep the module — the
 * convention is that placement reached from the UI thread lives in one of
 * these, with the directive on it.
 */
import { scrubPlacement } from '../scrubPlacement';
import type { TimeAxis } from '../../../components/melodyScale';

const axis: TimeAxis = { pad: 20, t0: 0, span: 10000, pxPerMs: 0.05 } as TimeAxis;
const HANDLE = 16;

describe('placing the scrub handle', () => {
  it('puts the trail at the moment, and the handle centred on it', () => {
    const { trailX, handleX } = scrubPlacement(axis, 4000, 0, HANDLE);
    expect(trailX).toBeCloseTo(20 + 4000 * 0.05, 6);
    expect(handleX).toBeCloseTo(trailX - HANDLE / 2, 6);
  });

  it('does not travel into the pickup', () => {
    // A handle before the singing would claim a moment the recording
    // does not have.
    expect(scrubPlacement(axis, 0, 2000, HANDLE).trailX).toBeCloseTo(
      scrubPlacement(axis, 2000, 2000, HANDLE).trailX,
      6
    );
  });

  it('does not travel past the end of the take', () => {
    expect(scrubPlacement(axis, 99999, 0, HANDLE).trailX).toBeCloseTo(
      scrubPlacement(axis, 10000, 0, HANDLE).trailX,
      6
    );
  });

  it('is declared a worklet, which is the whole point of the module', () => {
    // Reanimated strips the directive at build time, so this reads the
    // source rather than the function. Crude, and it is the only check
    // that exists for the one mistake that crashes a device outright.
    const source = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'scrubPlacement.ts'),
      'utf8'
    ) as string;
    expect(source).toContain("'worklet'");
  });
});
