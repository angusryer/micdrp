/**
 * INV-NOTES-182 — a threshold moves in useful amounts and in small ones.
 */
import { coarseStep, fineStep, steppedTo } from '../knobSteps';
import { SEGMENT_KNOBS } from '../segmentSettings';
import { READING_KNOBS } from '../knobOrder';

describe('the two step sizes', () => {
  it.each(SEGMENT_KNOBS.map((k) => [k.key, k] as const))(
    '%s crosses its range in about ten coarse presses',
    (_key, knob) => {
      const presses = (knob.max - knob.min) / coarseStep(knob);
      expect(presses).toBeGreaterThanOrEqual(5);
      expect(presses).toBeLessThanOrEqual(15);
    }
  );

  it.each(SEGMENT_KNOBS.map((k) => [k.key, k] as const))(
    '%s takes coarse presses that land where fine ones can',
    (_key, knob) => {
      // Otherwise the two controls walk on different grids and a value found
      // with one cannot be adjusted with the other.
      const multiples = coarseStep(knob) / fineStep(knob);
      expect(multiples).toBeCloseTo(Math.round(multiples), 8);
      expect(multiples).toBeGreaterThanOrEqual(1);
    }
  );

  it('is declared once, so every knob has both without saying so', () => {
    for (const knob of READING_KNOBS) {
      expect(coarseStep(knob)).toBeGreaterThan(0);
      expect(fineStep(knob)).toBeGreaterThan(0);
    }
  });
});

describe('where a press lands', () => {
  const knob = SEGMENT_KNOBS.find((k) => k.key === 'pitchHoldMs')!;

  it('moves by the step it was given', () => {
    expect(steppedTo(knob, 90, fineStep(knob))).toBe(90 + knob.step);
    expect(steppedTo(knob, 90, coarseStep(knob))).toBe(90 + coarseStep(knob));
  });

  it('stops at the ends rather than passing them', () => {
    expect(steppedTo(knob, knob.max, coarseStep(knob))).toBe(knob.max);
    expect(steppedTo(knob, knob.min, -coarseStep(knob))).toBe(knob.min);
  });

  it('brings a value off the grid back onto it', () => {
    // A stored setting from an older default must not leave every later press
    // half a step off for ever.
    const odd = knob.min + knob.step * 1.5;
    const landed = steppedTo(knob, odd, knob.step);
    expect((landed - knob.min) % knob.step).toBeCloseTo(0, 8);
  });

  it('reads a fractional knob without drifting', () => {
    const vibrato = SEGMENT_KNOBS.find((k) => k.key === 'vibratoSemitones')!;
    let at = vibrato.min;
    for (let i = 0; i < 5; i += 1) {
      at = steppedTo(vibrato, at, coarseStep(vibrato));
    }
    expect((at - vibrato.min) / vibrato.step).toBeCloseTo(
      Math.round((at - vibrato.min) / vibrato.step),
      8
    );
  });
});
