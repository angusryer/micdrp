import { smoothPitch } from '../smoothing';
import type { PitchFrame } from '../segmentation';

function frame(
  timestampMs: number,
  midi: number | null,
  clarity = 0.95,
  cents = 0
): PitchFrame {
  return { timestampMs, midi, cents, clarity };
}

describe('smoothPitch', () => {
  it('removes a single-frame outlier via the median', () => {
    const frames = [
      frame(0, 69),
      frame(10, 69),
      frame(20, 81), // spurious octave jump
      frame(30, 69),
      frame(40, 69)
    ];
    const out = smoothPitch(frames, { windowSize: 5 });
    expect(out.map((f) => f.midi)).toEqual([69, 69, 69, 69, 69]);
  });

  it('gates low-clarity frames to rests (windowSize 1)', () => {
    const frames = [frame(0, 69, 0.9), frame(10, 70, 0.2), frame(20, 69, 0.9)];
    const out = smoothPitch(frames, { windowSize: 1, minClarity: 0.5 });
    expect(out.map((f) => f.midi)).toEqual([69, null, 69]);
    expect(out[1].cents).toBeNull();
  });

  it('passes voiced frames through unchanged at windowSize 1', () => {
    const frames = [frame(0, 69, 0.9, 12), frame(10, 71, 0.9, -8)];
    const out = smoothPitch(frames, { windowSize: 1 });
    expect(out.map((f) => f.midi)).toEqual([69, 71]);
    expect(out.map((f) => f.cents)).toEqual([12, -8]);
  });

  it('preserves length and timestamps', () => {
    const frames = [frame(0, 69), frame(10, null), frame(20, 69)];
    const out = smoothPitch(frames, { windowSize: 3 });
    expect(out).toHaveLength(3);
    expect(out.map((f) => f.timestampMs)).toEqual([0, 10, 20]);
  });

  it('keeps an all-unvoiced stream unvoiced', () => {
    const frames = [frame(0, null), frame(10, null), frame(20, null)];
    const out = smoothPitch(frames, { windowSize: 3 });
    expect(out.every((f) => f.midi === null)).toBe(true);
  });
});
