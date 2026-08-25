/**
 * Where the playhead sits, and whether it is on the graph at all.
 *
 * Its own function because the drawing calls it from the UI thread every
 * frame (INV-NOTES-136) and it is the same mapping `xForMs` does — a worklet
 * cannot reach across to that module, so the mapping is stated once here and
 * workletized rather than copied into the animated style.
 *
 * Off either end it is hidden rather than clamped: a line parked at the edge
 * would claim the take is there.
 */
import type { TimeAxis } from '../../components/melodyScale';

/** How solid the line is when it is on the graph. */
const ON_OPACITY = 0.75;

export interface HeadPlacement {
  opacity: number;
  translateX: number;
}

export function headPlacement(
  axis: TimeAxis,
  positionMs: number
): HeadPlacement {
  'worklet';
  const isOn =
    axis.pxPerMs > 0 &&
    positionMs >= axis.t0 &&
    positionMs <= axis.t0 + axis.span;
  return {
    opacity: isOn ? ON_OPACITY : 0,
    translateX: axis.pad + (positionMs - axis.t0) * axis.pxPerMs
  };
}
