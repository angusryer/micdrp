/**
 * What a percentage means — shared, so the loop writing one and the app
 * reading one cannot disagree.
 */
import {
  creptPercent,
  nextMilestone,
  progressPatch,
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

describe('nextMilestone', () => {
  it('is where the step after this one begins', () => {
    expect(nextMilestone('claimed')).toBe(progressPercent('transcribing'));
    expect(nextMilestone('interpreting')).toBe(progressPercent('building'));
    expect(nextMilestone('verifying')).toBe(progressPercent('delivering'));
  });

  it('walks building one request at a time', () => {
    expect(nextMilestone('building', 0, 3)).toBe(progressPercent('building', 1, 3));
    expect(nextMilestone('building', 1, 3)).toBe(progressPercent('building', 2, 3));
    // The last request hands over to verifying rather than to itself.
    expect(nextMilestone('building', 2, 3)).toBe(85);
  });

  it('has nowhere left to go once it is done', () => {
    expect(nextMilestone('done')).toBe(100);
  });
});

describe('creptPercent', () => {
  const TYPICAL = 60_000;

  it('INV-DOG-029: keeps moving through a long step', () => {
    const a = creptPercent(30, 48, 10_000, TYPICAL);
    const b = creptPercent(30, 48, 30_000, TYPICAL);
    const c = creptPercent(30, 48, 60_000, TYPICAL);
    expect(a).toBeGreaterThan(30);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('INV-DOG-029: never reaches the next milestone, however long it runs', () => {
    for (const elapsed of [60_000, 600_000, 6_000_000, 60_000_000]) {
      expect(creptPercent(30, 48, elapsed, TYPICAL)).toBeLessThan(48);
    }
  });

  it('slows as it goes, so a long step never looks nearly finished', () => {
    const first = creptPercent(0, 100, TYPICAL, TYPICAL) - 0;
    const later =
      creptPercent(0, 100, 3 * TYPICAL, TYPICAL) -
      creptPercent(0, 100, 2 * TYPICAL, TYPICAL);
    expect(later).toBeLessThan(first);
  });

  it('never goes backwards from where the step began', () => {
    expect(creptPercent(30, 48, 0, TYPICAL)).toBe(30);
    expect(creptPercent(30, 48, -5, TYPICAL)).toBe(30);
  });

  it('stands still rather than guessing when there is no room or no estimate', () => {
    expect(creptPercent(85, 85, 10_000, TYPICAL)).toBe(85);
    expect(creptPercent(30, 48, 10_000, 0)).toBe(30);
  });
});

describe('progressPatch', () => {
  it('records the time when a real milestone is reached', () => {
    expect(progressPatch(48, 'building 2 of 3', true, 1234)).toEqual({
      progress_percent: 48,
      progress_note: 'building 2 of 3',
      progress_at_ms: 1234
    });
  });

  it('INV-DOG-030: an estimate never refreshes the time last heard from', () => {
    const patch = progressPatch(52, 'writing the change', false, 1234);
    expect(patch).not.toHaveProperty('progress_at_ms');
    expect(patch.progress_percent).toBe(52);
  });

  it('INV-DOG-030: so the stall clock still fires under a creeping bar', () => {
    // A run that went silent 20 minutes ago while its estimate kept moving.
    const lastHeard = 0;
    const patch = progressPatch(60, 'writing the change', false, 20 * 60 * 1000);
    expect(patch.progress_at_ms ?? lastHeard).toBe(lastHeard);
    expect(
      looksStalled(
        { percent: patch.progress_percent as number, note: '', atMs: lastHeard },
        20 * 60 * 1000
      )
    ).toBe(true);
  });

  it('keeps a note short enough for the row that shows it', () => {
    const patch = progressPatch(10, 'x'.repeat(400), true, 0);
    expect((patch.progress_note as string).length).toBe(120);
  });
});
