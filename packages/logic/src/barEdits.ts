/**
 * Moving, adding and removing bar lines.
 *
 * Split from bars.ts, which reads an arrangement; this changes one. Every
 * function returns a new layout and refuses rather than produces something
 * malformed — bars must stay in order and keep tiling the take, whatever
 * sequence of operations they are put through (INV-TRANS-014).
 *
 * None of this touches the audio, the beat grid, or a single note onset. A
 * person is correcting how a take is written down, not what they sang
 * (INV-TRANS-012).
 */
import type { BarLayout } from './bars';

/** Ascending and unique — the shape every operation preserves. */
function tidy(lines: readonly number[]): number[] {
  return Array.from(new Set(lines)).sort((a, b) => a - b);
}

/**
 * Propose an opening arrangement from a fitted grid.
 *
 * Detection still gets the first word; it just no longer gets the last one.
 */
export function proposeBars(
  beatsPerBar: number,
  stepsPerBeat: number,
  isCompound: boolean,
  totalSteps: number
): BarLayout {
  const barSteps = Math.max(1, Math.round(beatsPerBar * stepsPerBeat));
  const lines: number[] = [];
  for (let step = 0; step < Math.max(totalSteps, 1); step += barSteps) {
    lines.push(step);
  }
  // A take shorter than one bar is still one bar, not none.
  return { lines: lines.length > 0 ? lines : [0], stepsPerBeat, isCompound };
}

/**
 * Drag one line to another step.
 *
 * A line never crosses its neighbours, and never lands on one: either would
 * collapse a bar to nothing, and a bar of no length is not a thing a person
 * can have meant. The move is refused instead, so the gesture simply stops at
 * the edge rather than doing something surprising.
 */
export function moveBarLine(
  layout: BarLayout,
  index: number,
  toStep: number
): BarLayout {
  const lines = tidy(layout.lines);
  if (index < 0 || index >= lines.length) {
    return layout;
  }
  const lower = index > 0 ? lines[index - 1] : -1;
  const upper = index + 1 < lines.length ? lines[index + 1] : Number.MAX_SAFE_INTEGER;
  if (toStep <= lower || toStep >= upper || toStep < 0) {
    return layout;
  }
  const next = [...lines];
  next[index] = toStep;
  return { ...layout, lines: next };
}

/**
 * Split a bar by putting a line inside it.
 *
 * Moving lines alone cannot change how many bars there are, so a take
 * detected as four bars of four could never become five of three. This is what
 * makes every arrangement reachable.
 */
export function addBarLine(layout: BarLayout, atStep: number): BarLayout {
  if (atStep < 0 || layout.lines.includes(atStep)) {
    return layout;
  }
  return { ...layout, lines: tidy([...layout.lines, atStep]) };
}

/**
 * Merge two bars by taking the line between them away.
 *
 * Removing the last line is refused: a take with no bar lines has no bars,
 * and nothing downstream has anything to say about it.
 */
export function removeBarLine(layout: BarLayout, index: number): BarLayout {
  const lines = tidy(layout.lines);
  if (index < 0 || index >= lines.length || lines.length <= 1) {
    return layout;
  }
  return { ...layout, lines: lines.filter((_, i) => i !== index) };
}

/** The grid step nearest a time, for turning a drag into a placement. */
export function stepAtMs(
  ms: number,
  offsetMs: number,
  beatMs: number,
  stepsPerBeat: number
): number {
  const stepMs = beatMs / stepsPerBeat;
  return Math.max(0, Math.round((ms - offsetMs) / stepMs));
}
