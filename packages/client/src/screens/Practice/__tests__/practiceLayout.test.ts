/**
 * Unit tests for the practice overlay layout math (mirrored by the Skia
 * worklets). Validates the shared time axis, MIDI→y mapping, and culling.
 */
import {
  midiToY,
  nowX,
  pxPerMs,
  timeToX,
  visibleTargetSegments,
  type LayoutConfig
} from '../practiceLayout';

const CFG: LayoutConfig = {
  width: 300,
  height: 200,
  nowFraction: 0.5,
  windowMs: 3000,
  minMidi: 48,
  maxMidi: 72
};

describe('time axis', () => {
  it('places "now" at nowFraction of the width', () => {
    expect(nowX(CFG)).toBe(150);
    expect(timeToX(1000, 1000, CFG)).toBe(150); // current time sits at now
  });

  it('maps past to the left and future to the right of now', () => {
    const current = 1000;
    expect(timeToX(0, current, CFG)).toBeLessThan(nowX(CFG)); // 1s ago
    expect(timeToX(2000, current, CFG)).toBeGreaterThan(nowX(CFG)); // 1s ahead
  });

  it('scales by a constant px-per-ms', () => {
    expect(pxPerMs(CFG)).toBeCloseTo(0.1); // 300px / 3000ms
    // 1000ms ahead of now → +100px.
    expect(timeToX(2000, 1000, CFG)).toBeCloseTo(250);
  });
});

describe('midiToY', () => {
  it('puts the lowest note at the bottom and highest at the top', () => {
    expect(midiToY(48, CFG)).toBe(200); // bottom edge
    expect(midiToY(72, CFG)).toBe(0); // top edge
  });

  it('clamps out-of-range notes to the edges', () => {
    expect(midiToY(24, CFG)).toBe(200);
    expect(midiToY(96, CFG)).toBe(0);
  });
});

describe('visibleTargetSegments', () => {
  const targets = [
    { midi: 60, startMs: 0, endMs: 500 },
    { midi: 62, startMs: 500, endMs: 1000 },
    { midi: 64, startMs: 10_000, endMs: 10_500 } // far future → off-screen
  ];

  it('returns segments for in-view notes and culls off-screen ones', () => {
    const segs = visibleTargetSegments(targets, 750, CFG);
    // The far-future note is culled.
    expect(segs).toHaveLength(2);
    for (const s of segs) {
      expect(s.x2).toBeGreaterThan(s.x1);
    }
  });

  it('scrolls left as the transport advances', () => {
    const early = visibleTargetSegments(targets, 0, CFG)[0];
    const later = visibleTargetSegments(targets, 500, CFG)[0];
    expect(later.x1).toBeLessThan(early.x1);
  });
});
