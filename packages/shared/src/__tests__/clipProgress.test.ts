/**
 * What a percentage means — shared, so the loop writing one and the app
 * reading one cannot disagree.
 */
import {
  looksStalled,
  progressPercent,
  type ClipPhase
} from '../dto/clipProgress';

describe('progressPercent', () => {
  it('rises through the phases and never falls back', () => {
    const order: ClipPhase[] = [
      'claimed', 'transcribing', 'interpreting', 'building',
      'verifying', 'delivering', 'done'
    ];
    const values = order.map((p) => progressPercent(p));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('finishes at exactly one hundred', () => {
    expect(progressPercent('done')).toBe(100);
  });

  it('moves through building as requests are finished', () => {
    // Four requests should move the bar four times, not leave it at 30 for
    // twenty minutes.
    const steps = [0, 1, 2, 3, 4].map((d) => progressPercent('building', d, 4));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    expect(steps[4]).toBe(85);
  });

  it('gives building most of the bar, because it is most of the time', () => {
    expect(progressPercent('building', 4, 4) - progressPercent('building', 0, 4))
      .toBeGreaterThan(50);
  });

  it('never exceeds the end of building, however many are reported done', () => {
    expect(progressPercent('building', 99, 4)).toBe(85);
  });

  it('copes with a clip that has no requests to build', () => {
    expect(progressPercent('building', 0, 0)).toBe(30);
  });

  it('stays within nought and a hundred whatever it is given', () => {
    for (const [d, t] of [[-5, 4], [0, 0], [3, 1], [1, -1]]) {
      const p = progressPercent('building', d, t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

describe('looksStalled', () => {
  const at = (percent: number, atMs: number) => ({ percent, note: '', atMs });

  it('says nothing about a clip that has never reported', () => {
    expect(looksStalled(null, 1_000_000)).toBe(false);
  });

  it('never calls a finished clip stuck', () => {
    expect(looksStalled(at(100, 0), 9_999_999)).toBe(false);
  });

  it('calls a clip stuck once it has been silent too long', () => {
    expect(looksStalled(at(40, 0), 20 * 60 * 1000)).toBe(true);
  });

  it('leaves a clip alone while it is still reporting', () => {
    expect(looksStalled(at(40, 0), 60 * 1000)).toBe(false);
  });
});
