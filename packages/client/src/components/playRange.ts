/**
 * A stretch of time somebody wants to hear again.
 *
 * Deliberately knows nothing about notes, graphs or takes. It is two moments
 * and the rules for moving them, so the same stretch can mark out a retimed
 * note today and a loop, a trim, or a section to practise later
 * (INV-NOTES-178, INV-NOTES-179).
 *
 * Pure, so the rules are tested without a screen.
 */

/** Two moments in a recording, the first before the second. */
export interface PlayRange {
  fromMs: number;
  toMs: number;
}

/** Which end of it is being moved. */
export type RangeEdge = 'from' | 'to';

/** How short a stretch is allowed to get, in ms. */
export const MIN_RANGE_MS = 120;

/**
 * How much room to leave either side of the thing being listened to.
 *
 * Timing is judged against what surrounds it, so a stretch holding only the
 * thing itself answers nothing. Rather more after than before: what a note
 * runs into is usually what makes it early or late.
 */
export const LEAD_IN_MS = 700;
export const LEAD_OUT_MS = 1100;

/** The whole of what may be played, so a stretch cannot run off either end. */
export interface RangeBounds {
  startMs: number;
  endMs: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/**
 * A stretch around something, with room either side.
 *
 * Returns null where the bounds cannot hold a stretch at all, so a caller with
 * nothing to play is told so rather than handed an empty one.
 */
export function rangeAround(
  fromMs: number,
  toMs: number,
  bounds: RangeBounds,
  leadInMs: number = LEAD_IN_MS,
  leadOutMs: number = LEAD_OUT_MS
): PlayRange | null {
  const room = bounds.endMs - bounds.startMs;
  if (!(room >= MIN_RANGE_MS)) {
    return null;
  }
  const wantedFrom = Math.min(fromMs, toMs) - leadInMs;
  const wantedTo = Math.max(fromMs, toMs) + leadOutMs;
  const from = clamp(wantedFrom, bounds.startMs, bounds.endMs - MIN_RANGE_MS);
  const to = clamp(wantedTo, from + MIN_RANGE_MS, bounds.endMs);
  return { fromMs: from, toMs: to };
}

/**
 * Move one end of a stretch, leaving the other where it is.
 *
 * An end stops against its opposite rather than pushing it: the other end was
 * put where it is on purpose, and a drag that moved both would undo that
 * without saying so (INV-NOTES-179).
 */
export function moveEdge(
  range: PlayRange,
  edge: RangeEdge,
  toMs: number,
  bounds: RangeBounds
): PlayRange {
  if (edge === 'from') {
    return {
      ...range,
      fromMs: clamp(toMs, bounds.startMs, range.toMs - MIN_RANGE_MS)
    };
  }
  return {
    ...range,
    toMs: clamp(toMs, range.fromMs + MIN_RANGE_MS, bounds.endMs)
  };
}

/** How long a stretch runs for, in ms. */
export function rangeLengthMs(range: PlayRange): number {
  return Math.max(0, range.toMs - range.fromMs);
}

/** Whether a moment falls inside a stretch. */
export function isWithin(range: PlayRange, atMs: number): boolean {
  return atMs >= range.fromMs && atMs <= range.toMs;
}
