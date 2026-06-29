import { scorePitch } from '../scoring';
import type { TargetNote } from '../scoring';
import type { PitchFrame } from '../segmentation';

function frame(
  timestampMs: number,
  midi: number | null,
  cents = 0,
  clarity = 0.95
): PitchFrame {
  return { timestampMs, midi, cents, clarity };
}

const target = (midi: number, startMs: number, endMs: number): TargetNote => ({
  midi,
  startMs,
  endMs
});

describe('scorePitch', () => {
  it('scores a perfect take 100', () => {
    const frames: PitchFrame[] = [];
    for (let t = 0; t < 100; t += 10) {
      frames.push(frame(t, 69, 0));
    }
    const result = scorePitch(frames, [target(69, 0, 100)]);
    expect(result.score).toBe(100);
    expect(result.inTuneRatio).toBe(1);
    expect(result.meanCentsError).toBe(0);
    expect(result.evaluatedFrames).toBe(10);
  });

  it('treats a consistent 50-cent offset as in-tune at the default tolerance', () => {
    const frames = [frame(0, 69, 50), frame(10, 69, 50)];
    const result = scorePitch(frames, [target(69, 0, 100)]);
    expect(result.inTuneRatio).toBe(1);
    expect(result.meanCentsError).toBe(50);
    expect(result.score).toBe(75); // 1 - 50/200 = 0.75
  });

  it('penalises out-of-tune frames', () => {
    const frames = [
      frame(0, 69, 0), // perfect
      frame(10, 72, 0) // 300 cents sharp
    ];
    const result = scorePitch(frames, [target(69, 0, 100)]);
    expect(result.inTuneRatio).toBe(0.5);
    expect(result.meanCentsError).toBe(150);
    expect(result.score).toBe(50); // mean(1, 0) * 100
  });

  it('ignores octave errors when asked', () => {
    const frames = [frame(0, 81, 0)]; // an octave above the A4 target
    expect(scorePitch(frames, [target(69, 0, 100)]).score).toBe(0);
    expect(
      scorePitch(frames, [target(69, 0, 100)], { ignoreOctave: true }).score
    ).toBe(100);
  });

  it('skips unvoiced frames and frames with no target', () => {
    const frames = [
      frame(0, null), // unvoiced
      frame(10, 69, 0), // on target
      frame(500, 69, 0) // past the target window
    ];
    const result = scorePitch(frames, [target(69, 0, 100)]);
    expect(result.evaluatedFrames).toBe(1);
    expect(result.score).toBe(100);
  });

  it('returns a zero score when nothing is evaluated', () => {
    const result = scorePitch([frame(0, null)], [target(69, 0, 100)]);
    expect(result).toEqual({
      score: 0,
      inTuneRatio: 0,
      meanCentsError: 0,
      evaluatedFrames: 0
    });
  });
});
