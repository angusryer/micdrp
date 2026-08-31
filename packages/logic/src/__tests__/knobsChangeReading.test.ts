/**
 * INV-NOTES-172 — the thresholds actually change what is read.
 *
 * The knobs were threaded from the panel through to `readTake` and never
 * checked to arrive. A reading that quietly ignored them would look exactly
 * like a reading that could not happen, which is the shape every fault in
 * this area has taken so far.
 */
import { readTake } from '../readTake';
import type { PitchFrame } from '../segmentation';

const HOP = 10;

const frames = (
  count: number,
  at: number,
  make: (i: number) => Partial<PitchFrame>
): PitchFrame[] =>
  Array.from({ length: count }, (_, i) => ({
    timestampMs: at + i * HOP,
    midi: null,
    cents: null,
    clarity: 0,
    levelDb: -75,
    centroidHz: 0,
    flatness: 0,
    ...make(i)
  }));

const sung = (at: number, ms: number) =>
  frames(Math.ceil(ms / HOP), at, () => ({
    midi: 62,
    cents: 0,
    clarity: 0.95,
    levelDb: -14,
    centroidHz: 294,
    flatness: 0.02
  }));

/**
 * The pitch lost while the level holds — the detector losing confidence
 * rather than the singer stopping.
 *
 * The level is held on purpose. A dropout that also drops the level ends the
 * note on the level rule, which fires whatever the gap allows, so a fixture
 * built that way could never show what the gap rule does.
 */
const lost = (at: number, ms: number) =>
  frames(Math.ceil(ms / HOP), at, () => ({
    clarity: 0.05,
    levelDb: -14,
    centroidHz: 294,
    flatness: 0.02
  }));

/** One pitch, briefly lost, then held again. */
const withDropout = (gapMs: number): PitchFrame[] => [
  ...sung(0, 500),
  ...lost(500, gapMs),
  ...sung(500 + gapMs, 500)
];

describe('the thresholds reach the reading', () => {
  it('drops what is said to be too brief to have been intended', () => {
    const take = withDropout(60);
    const kept = readTake(take, 'mixed', { minArticulationMs: 10 }).notes;
    const dropped = readTake(take, 'mixed', { minArticulationMs: 5000 }).notes;
    expect(kept.length).toBeGreaterThan(0);
    expect(dropped.length).toBeLessThan(kept.length);
  });
});

/**
 * Smoothing runs before segmentation, so it decides what the segmenter is
 * ever shown. A dropout shorter than the median window is filled in before
 * `maxGapMs` is consulted, and no setting of that knob can then split the
 * note — which is why turning it alone appears to do nothing.
 *
 * Measured rather than assumed: `segmentNotes` on the raw frames splits this
 * take at maxGapMs 20, and the same take through `readTake` does not.
 */
describe('what smoothing decides before the gap rule sees it', () => {
  const take = withDropout(60);

  it('holds a tongued repeat together at the default window, whatever the gap allows', () => {
    for (const maxGapMs of [20, 200]) {
      expect(readTake(take, 'mixed', { segment: { maxGapMs } }).notes).toHaveLength(
        1
      );
    }
  });

  it('comes apart once the smoothing window is lowered', () => {
    // windowSize 1 turns the median off, so the dropout survives to be judged.
    const apart = readTake(take, 'mixed', {
      smooth: { windowSize: 1 },
      segment: { maxGapMs: 20 }
    }).notes;
    expect(apart.length).toBeGreaterThan(1);
  });

  it('and stays together at that window when the gap allowed is raised', () => {
    const together = readTake(take, 'mixed', {
      smooth: { windowSize: 1 },
      segment: { maxGapMs: 200 }
    }).notes;
    expect(together).toHaveLength(1);
  });
});
