/**
 * How far one press moves a threshold (INV-NOTES-182).
 *
 * Tuning is a loop and the loop has two halves: finding roughly where the
 * answer is, then settling exactly on it. One step size serves either but not
 * both — a step small enough to settle with takes thirty presses to cross the
 * range, which is not a search; a step big enough to search with cannot be
 * settled on.
 *
 * The coarse step is derived from the range rather than declared, so a knob
 * added to the table needs no second entry here and the two cannot drift
 * (Axiom 2). It is rounded to a whole multiple of the fine step, so coarse
 * presses land on values fine presses can also reach — otherwise the two
 * controls would walk on different grids and a value found with one could not
 * be adjusted with the other.
 */
import type { SegmentKnob } from './segmentSettings';

/** About how many coarse presses should cross a knob's whole range. */
const PRESSES_ACROSS = 10;

/** The fine step: the smallest change the knob was declared to take. */
export function fineStep(knob: SegmentKnob): number {
  return knob.step;
}

/**
 * The coarse step: a tenth of the range, on the fine step's own grid.
 *
 * Never less than one fine step, so a knob whose range is small enough that a
 * tenth of it rounds to nothing still moves.
 */
export function coarseStep(knob: SegmentKnob): number {
  const wanted = (knob.max - knob.min) / PRESSES_ACROSS;
  const multiples = Math.max(1, Math.round(wanted / knob.step));
  return multiples * knob.step;
}

/**
 * Where a press lands.
 *
 * Rounded back onto the fine step's grid from the knob's own minimum, so a
 * value that arrived from anywhere — a stored setting, an older default —
 * cannot leave every later press half a step off.
 */
export function steppedTo(
  knob: SegmentKnob,
  value: number,
  by: number
): number {
  const moved = value + by;
  const grid = Math.round((moved - knob.min) / knob.step);
  const snapped = knob.min + grid * knob.step;
  return Math.min(knob.max, Math.max(knob.min, snapped));
}
