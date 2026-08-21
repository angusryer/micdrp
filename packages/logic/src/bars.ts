/**
 * Bars as an arrangement of the beat grid, rather than something detected.
 *
 * Metre detection is the weakest inference in the whole analysis: over a
 * corpus of real sung takes it scores 0.17 against a threshold of 0.25, so
 * most takes fall back to 4/4 and admit it. Rather than guess harder, this
 * makes the answer editable.
 *
 * The beat grid is fixed — it comes from tempo, which is measured well — and a
 * bar line can only sit on one of its steps. A bar's time signature is then
 * read off the distance between its lines. Moving a line lengthens one bar and
 * shortens its neighbour; the total never changes and the take is never
 * touched (INV-TRANS-012).
 *
 * Steps rather than beats, because seven or thirteen eighths is not a whole
 * number of beats in any grouping, and those metres have to be expressible
 * (INV-TRANS-013).
 *
 * Pure, dependency-free.
 */

export interface BarLayout {
  /** Grid step indices where bars begin: ascending, no repeats. */
  lines: readonly number[];
  stepsPerBeat: number;
  isCompound: boolean;
}

export interface Bar {
  /** 1-based among the bars; a pickup is 0. */
  index: number;
  startStep: number;
  steps: number;
  timeSignature: string;
  isPickup: boolean;
}

/**
 * Note values a bar may be written in, coarsest first, as steps per unit.
 *
 * A sixteenth is the finest the grid resolves, so it is the last resort and
 * always divides — which is what stops any bar length falling back to a
 * default the way detected metre used to.
 */
function unitsFor(stepsPerBeat: number, isCompound: boolean): [number, number][] {
  // stepsPerBeat is 4 in simple metre (the beat is a quarter, steps are
  // sixteenths) and 6 in compound (the beat is a dotted quarter).
  const sixteenth = isCompound ? stepsPerBeat / 6 : stepsPerBeat / 4;
  const eighth = sixteenth * 2;
  const quarter = sixteenth * 4;
  // Compound metre is written in eighths: three quarters and six eighths are
  // the same length and different feels, so arithmetic alone cannot choose.
  return isCompound
    ? [[eighth, 8], [sixteenth, 16]]
    : [[quarter, 4], [eighth, 8], [sixteenth, 16]];
}

/**
 * How a bar of this many steps is written.
 *
 * The coarsest note value that divides it evenly: 16 steps is 4/4, 14 is 7/8,
 * 13 is 13/16. Nothing is rounded — a signature that did not match the bar
 * would be the same lie detected metre was telling.
 */
export function timeSignatureOf(
  steps: number,
  stepsPerBeat: number,
  isCompound: boolean
): string {
  for (const [stepsPerUnit, denominator] of unitsFor(stepsPerBeat, isCompound)) {
    if (stepsPerUnit > 0 && steps % stepsPerUnit === 0) {
      return `${steps / stepsPerUnit}/${denominator}`;
    }
  }
  return `${steps}/${stepsPerBeat * 4}`;
}

/** Keep lines ascending and unique — the shape every operation must preserve. */
function tidy(lines: readonly number[]): number[] {
  return Array.from(new Set(lines)).sort((a, b) => a - b);
}

/** Read the bars, and their signatures, out of an arrangement of lines. */
export function readBars(layout: BarLayout, totalSteps: number): Bar[] {
  const lines = tidy(layout.lines).filter((s) => s < totalSteps);
  if (lines.length === 0) {
    return [];
  }
  const bars: Bar[] = [];

  // Steps before the first line are a pickup. Singers start mid-bar
  // constantly; calling that bar one puts every downbeat after it wrong.
  if (lines[0] > 0) {
    bars.push({
      index: 0,
      startStep: 0,
      steps: lines[0],
      timeSignature: timeSignatureOf(lines[0], layout.stepsPerBeat, layout.isCompound),
      isPickup: true
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const start = lines[i];
    const end = i + 1 < lines.length ? lines[i + 1] : totalSteps;
    bars.push({
      index: i + 1,
      startStep: start,
      steps: end - start,
      timeSignature: timeSignatureOf(end - start, layout.stepsPerBeat, layout.isCompound),
      isPickup: false
    });
  }
  return bars;
}
