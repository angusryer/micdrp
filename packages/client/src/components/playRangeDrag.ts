/**
 * How far each end of a stretch may be dragged, and what it means when it
 * lands (INV-NOTES-235).
 *
 * Split from the overlay so that file stays the drawing. The two ends move on
 * the UI thread, so these are the only two things the JS side still has to
 * work out: where the travel stops, and what a resting pixel is in
 * milliseconds.
 */
import { msForX, xForMs, type TimeAxis } from './melodyScale';
import { MIN_RANGE_MS, type RangeEdge } from './playRange';

/** How far one end may travel, in the graph's own pixel space. */
export interface EdgeLimits {
  lowX: number;
  highX: number;
}

export interface DragLimits {
  from: EdgeLimits;
  to: EdgeLimits;
}

/**
 * Where each end may go, read off the committed stretch.
 *
 * Off the commit rather than off the other end's live value: only one end is
 * dragged at a time, and a limit that moved while the finger was down would
 * be a limit that could be pushed.
 *
 * The far end is the drawn axis rather than the take's own end. The commit
 * clamps again against the take (`moveEdge`), so the two agree everywhere the
 * take is what is drawn, and where they do not the commit is what wins.
 */
export function dragLimits(
  axis: TimeAxis,
  leftX: number,
  rightX: number
): DragLimits {
  const leastApart = MIN_RANGE_MS * axis.pxPerMs;
  return {
    from: { lowX: axis.pad, highX: rightX - leastApart },
    to: { lowX: leftX + leastApart, highX: xForMs(axis, axis.t0 + axis.span) }
  };
}

/** What a resting pixel means, said once when the finger leaves. */
export function settledAt(
  axis: TimeAxis,
  edge: RangeEdge,
  onMoveEnd: (edge: RangeEdge, toMs: number) => void
): (x: number) => void {
  return (x: number) => onMoveEnd(edge, msForX(axis, x));
}
