/**
 * Flicking a line off the graph.
 *
 * Everything vertical on the graph — a bar line, a tapped beat — is a claim
 * about time that somebody may simply want gone. There was no way to say that:
 * a line could be moved and chosen, and getting rid of one meant finding a
 * control somewhere else for a thing that is right there under the finger
 * (INV-NOTES-132).
 *
 * A flick, because these lines already move horizontally. Dragging sideways is
 * how a line is placed, so the one direction left free is across it — and
 * throwing something off the top or bottom of the graph is the gesture people
 * already have for discarding.
 *
 * Deliberately not a swipe: a slow vertical drag is somebody who has not
 * decided yet, and speed is what separates a decision from a wobble. Losing a
 * hand-placed bar line to a stray finger is worse than having to flick twice.
 */
import type { Chosen, Selection } from './graphSelection';

/** How far across the line a flick must travel, in pixels. */
const FLICK_PX = 40;

/** And how fast, in pixels per second. */
const FLICK_VELOCITY = 700;

/** How much straighter than sideways it must be, as a ratio. */
const STRAIGHTNESS = 2;

export interface Flick {
  translationX: number;
  translationY: number;
  velocityY: number;
}

/**
 * Whether a finished drag was a flick across the line rather than along it.
 *
 * All three tests, because each one alone is something else: far but slow is a
 * drag, fast but short is a tap that slipped, and either while travelling
 * sideways is a line being placed.
 */
export function isFlickAway({
  translationX,
  translationY,
  velocityY
}: Flick): boolean {
  const across = Math.abs(translationY);
  return (
    across >= FLICK_PX &&
    Math.abs(velocityY) >= FLICK_VELOCITY &&
    across >= Math.abs(translationX) * STRAIGHTNESS
  );
}

/** A vertical line, and where in its own list it sits. */
type Line = Extract<Selection, { kind: 'barLine' } | { kind: 'beat' }>;

const indexOf = (one: Line): number =>
  one.kind === 'barLine' ? one.lineIndex : one.index;

/**
 * Throw away every vertical line in a selection.
 *
 * Highest index first: removing one shifts every index after it, so taking
 * them in order would delete the wrong neighbours. Returns how many went, so
 * a caller knows whether the flick meant anything.
 */
export function throwAway(
  selection: Chosen,
  onRemoveBar?: (lineIndex: number) => void,
  onRemoveBeat?: (index: number) => void
): number {
  const lines = selection.filter(
    (one): one is Line => one.kind === 'barLine' || one.kind === 'beat'
  );
  for (const one of [...lines].sort((a, b) => indexOf(b) - indexOf(a))) {
    if (one.kind === 'barLine') {
      onRemoveBar?.(one.lineIndex);
    } else {
      onRemoveBeat?.(one.index);
    }
  }
  return lines.length;
}
