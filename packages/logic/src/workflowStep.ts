/**
 * Where a take is in its workflow, and what comes next (INV-NOTES-267).
 *
 * The order is INT-NOTES-028..033: record, count in, correct, bassline,
 * chords. Derived from what the take already has rather than remembered,
 * so the take — not the person — keeps track of where it is, and a step
 * that is already satisfied is skipped rather than shown.
 *
 * Correcting is not a step here. Nothing in the data can say corrections
 * are finished, so it is a standing offer alongside every step from the
 * count-in on, never a gate in front of the next one.
 */

export type WorkflowStep = 'count-in' | 'bassline' | 'chords' | 'done';

/** What the take has, as far as the workflow can tell. */
export interface WorkflowFacts {
  hasPickup: boolean;
  hasBassline: boolean;
  hasHarmony: boolean;
}

/** The first thing the take does not have yet, in workflow order. */
export function nextStep(facts: WorkflowFacts): WorkflowStep {
  if (!facts.hasPickup) {
    return 'count-in';
  }
  if (!facts.hasBassline) {
    return 'bassline';
  }
  if (!facts.hasHarmony) {
    return 'chords';
  }
  return 'done';
}

/** Which step this is of the ones a person is led through, one-based. */
export function stepNumber(step: WorkflowStep): number {
  switch (step) {
    case 'count-in':
      return 1;
    case 'bassline':
      return 2;
    case 'chords':
      return 3;
    default:
      return 3;
  }
}

/** How many steps a person is led through after recording. */
export const LED_STEPS = 3;
