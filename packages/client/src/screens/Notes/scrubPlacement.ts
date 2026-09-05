/**
 * Where the scrub handle sits, worked out on the UI thread.
 *
 * Its own module with `'worklet'` on it, exactly as `playheadPlacement`
 * is, because that is the only shape that survives being called from an
 * animated style. The first attempt at this called `xForMs` from inside
 * `useAnimatedStyle` — ordinary arithmetic, and ordinary JavaScript, and
 * the app crashed natively the instant a note was opened. A function
 * reached from the UI thread has to be a worklet; there is no partial
 * version of that rule and nothing in the type system says so.
 *
 * Pure, so the arithmetic can be tested from Jest even though the
 * violation it guards against cannot be.
 */
import type { TimeAxis } from '../../components/melodyScale';

export interface ScrubPlacement {
  /** Left edge of the trailing line, in px. */
  trailX: number;
  /** Left edge of the handle, in px, already offset by half its width. */
  handleX: number;
}

/**
 * Place the handle and the line under it from one moment.
 *
 * Clamped to the take: there is nothing to hear beyond either end, and a
 * handle that travelled into the pickup would claim a moment the
 * recording does not have.
 *
 * The arithmetic is inline rather than borrowed from `xForMs`. They agree
 * by being one line each, which is the trade this makes: a worklet cannot
 * call across to a plain function, so the choice is duplicating a sum or
 * marking a widely-used helper as a worklet and hoping nobody unmarks it.
 */
export function scrubPlacement(
  axis: TimeAxis,
  positionMs: number,
  firstNoteMs: number,
  handleWidth: number
): ScrubPlacement {
  'worklet';
  const lastMs = axis.t0 + axis.span;
  const at = Math.min(Math.max(positionMs, firstNoteMs), lastMs);
  const x = axis.pad + (at - axis.t0) * axis.pxPerMs;
  return { trailX: x, handleX: x - handleWidth / 2 };
}
