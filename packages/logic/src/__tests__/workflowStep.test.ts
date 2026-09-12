/**
 * INV-NOTES-267 — the take knows where it is in the workflow.
 */
import { LED_STEPS, nextStep, stepNumber } from '../workflowStep';

describe('nextStep', () => {
  it('names the count-in for a fresh take', () => {
    expect(nextStep({ hasPickup: false, hasBassline: false, hasHarmony: false })).toBe('count-in');
  });

  it('names the bassline once the count-in is made', () => {
    expect(nextStep({ hasPickup: true, hasBassline: false, hasHarmony: false })).toBe('bassline');
  });

  it('names the chords once the bassline is sung', () => {
    expect(nextStep({ hasPickup: true, hasBassline: true, hasHarmony: false })).toBe('chords');
  });

  it('is done when the take has everything', () => {
    expect(nextStep({ hasPickup: true, hasBassline: true, hasHarmony: true })).toBe('done');
  });

  it('skips a step already satisfied out of order rather than showing it', () => {
    // A bassline sung before any count-in: the count-in is still next,
    // and the bassline is not asked for again afterwards.
    expect(nextStep({ hasPickup: false, hasBassline: true, hasHarmony: false })).toBe('count-in');
    expect(nextStep({ hasPickup: true, hasBassline: true, hasHarmony: false })).toBe('chords');
  });
});

describe('stepNumber', () => {
  it('counts the led steps in order, and never past the last', () => {
    expect(stepNumber('count-in')).toBe(1);
    expect(stepNumber('bassline')).toBe(2);
    expect(stepNumber('chords')).toBe(3);
    expect(stepNumber('done')).toBe(LED_STEPS);
  });
});
