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

/**
 * How long the pickup runs, in steps — the first bar line (INV-NOTES-211).
 *
 * Zero for a take that opens on a downbeat, which has no pickup rather than
 * one of no length.
 */
export function pickupSteps(layout: BarLayout): number {
  return layout.lines.length > 0 ? Math.max(0, layout.lines[0]) : 0;
}

/**
 * Say how long the pickup is, and move the music to suit (INV-NOTES-211).
 *
 * Every line shifts by the same amount, so the bars keep the lengths they
 * had and the whole arrangement moves. `moveBarLine` cannot do this: it
 * holds a line between its neighbours, which resizes the first bar instead
 * of shifting the music — so the only way to say "this take has a two-beat
 * pickup" was to drag every line in turn and hope they stayed even.
 *
 * A pickup is how far into a bar the singing started. The bars after it are
 * unchanged by that; they were always going to be bars.
 *
 * Lines pushed past the end of the take are dropped rather than kept beyond
 * it, and a shift that would leave nothing is refused.
 */
export function withPickup(
  layout: BarLayout,
  toSteps: number,
  totalSteps: number
): BarLayout {
  const lines = tidy(layout.lines);
  if (lines.length === 0 || toSteps < 0) {
    return layout;
  }
  const shift = Math.round(toSteps) - lines[0];
  if (shift === 0) {
    return layout;
  }
  const moved = lines
    .map((step) => step + shift)
    .filter((step) => step >= 0 && step < totalSteps);
  // A take still has to have somewhere its bars begin.
  return moved.length > 0 ? { ...layout, lines: moved } : layout;
}
