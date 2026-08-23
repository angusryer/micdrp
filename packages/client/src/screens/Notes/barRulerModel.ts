/**
 * What the bar ruler needs to know, worked out without a screen.
 *
 * Kept apart from the component so the arithmetic that matters — which line a
 * finger is on, what the bars would read as if it were dropped here — is
 * testable. The component only paints and listens.
 */
import { readBars, timeSignatureOf, type BarLayout } from 'logic';

/** A bar line as something to grab, at a pixel position. */
export interface BarHandle {
  /** Index into the layout's lines, which is what a move refers to. */
  lineIndex: number;
  step: number;
  x: number;
}

export interface RulerGeometry {
  /** Pixel x of grid step zero. */
  originX: number;
  /** Pixel width of one grid step. */
  stepWidth: number;
}

/** Pixel position of a grid step. The one place steps become pixels. */
export function xAtStep(step: number, geometry: RulerGeometry): number {
  return geometry.originX + step * geometry.stepWidth;
}

/** Where each bar line sits on screen. */
export function barHandles(
  layout: BarLayout,
  geometry: RulerGeometry
): BarHandle[] {
  return layout.lines.map((step, lineIndex) => ({
    lineIndex,
    step,
    x: xAtStep(step, geometry)
  }));
}

/** The grid step under a pixel position, never below the start of the take. */
export function stepAtX(x: number, geometry: RulerGeometry): number {
  if (!(geometry.stepWidth > 0)) {
    return 0;
  }
  return Math.max(0, Math.round((x - geometry.originX) / geometry.stepWidth));
}

/**
 * Where a line dragged towards `toStep` would actually end up.
 *
 * A line cannot cross or land on its neighbours, so a drag heading past one
 * stops against it rather than being refused on release. The first line is the
 * exception at the bottom: it may sit at step zero, which is a take that
 * begins on a downbeat rather than one with a pickup.
 */
export function landingStep(
  layout: BarLayout,
  totalSteps: number,
  lineIndex: number,
  toStep: number
): number {
  const lines = layout.lines;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return Math.max(0, toStep);
  }
  const lower = lineIndex > 0 ? lines[lineIndex - 1] : 0;
  const upper = lineIndex + 1 < lines.length ? lines[lineIndex + 1] : totalSteps;
  const lowest = lineIndex === 0 ? 0 : lower + 1;
  return Math.min(Math.max(toStep, lowest), upper - 1);
}

/**
 * What the bars either side of a line would read as, were it dropped here.
 *
 * This is the whole point of the readout: a person dragging a bar line is
 * choosing two time signatures at once, and the one they are not looking at
 * is the one that surprises them.
 */
export function previewSignatures(
  layout: BarLayout,
  totalSteps: number,
  lineIndex: number,
  toStep: number
): string {
  const lines = layout.lines;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return '';
  }
  const lower = lineIndex > 0 ? lines[lineIndex - 1] : 0;
  const upper = lineIndex + 1 < lines.length ? lines[lineIndex + 1] : totalSteps;

  // The readout shows where the line would actually end up rather than where
  // the finger is, so that it agrees with the line drawn under the finger.
  const step = landingStep(layout, totalSteps, lineIndex, toStep);
  const before = step - lower;
  const after = upper - step;

  const sig = (steps: number) =>
    timeSignatureOf(steps, layout.stepsPerBeat, layout.isCompound);

  // Nothing before the first line means no pickup, so there is only one bar
  // for the drag to be deciding.
  return before === 0 ? sig(after) : `${sig(before)} · ${sig(after)}`;
}

/** A drag in flight: where the line is now, and what letting go would mean. */
export interface BarDrop {
  /** The step the drop will commit, already inside what the layout allows. */
  step: number;
  /** Pixel x of that step, which is where the line is drawn while dragging. */
  x: number;
  /** What the bars either side would read as (INV-NOTES-025). */
  label: string;
}

/**
 * Read a live drag: one answer for the line, the readout and the drop.
 *
 * They have to agree. A line drawn where the finger is, a readout for the
 * step it would clamp to and a drop that refuses outright are three different
 * claims about the same gesture, and two of them are lies (INV-NOTES-028).
 */
export function dropAtX(
  layout: BarLayout,
  totalSteps: number,
  geometry: RulerGeometry,
  lineIndex: number,
  x: number
): BarDrop {
  const step = landingStep(layout, totalSteps, lineIndex, stepAtX(x, geometry));
  return {
    step,
    x: xAtStep(step, geometry),
    label: previewSignatures(layout, totalSteps, lineIndex, step)
  };
}

/** Bar numbers and signatures as they stand, for labelling the ruler. */
export function barLabels(layout: BarLayout, totalSteps: number): string[] {
  return readBars(layout, totalSteps).map((bar) =>
    bar.isPickup ? `pickup ${bar.timeSignature}` : `${bar.index} · ${bar.timeSignature}`
  );
}
