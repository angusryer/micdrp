/**
 * How tall the graph is drawn, given what is covering the page.
 *
 * Pure, and its own file, because it is the whole of a decision that reads
 * as arithmetic in the middle of a screen: a sheet opened over the note is
 * opened to work on the note, so the note has to still be on the screen
 * (INV-NOTES-226).
 */

/** Below this it stops being a graph, whatever room is left. */
export const MIN_GRAPH_CARD = 204;

export interface GraphRoom {
  /** The page's own height, measured rather than assumed. */
  viewportPx: number;
  /** How much of it the open sheets are covering, and zero when none is. */
  coveredPx: number;
  /** The share it takes when nothing covers it. */
  usualPx: number;
  /** What sits above the graph once the page is scrolled to it. */
  headerPx: number;
}

/**
 * The room between the header and the top of the sheet, never more than the
 * graph usually takes and never less than one can be drawn in.
 *
 * Never more, because a sheet is not a reason for the graph to grow; the
 * share it has is what the page was laid out around. Never less, because a
 * graph too short to put a finger in is not a graph — a sheet dragged to the
 * top of the screen leaves nothing, and the answer to that is a page that
 * scrolls, not a drawing squeezed to a line.
 */
export function graphHeightFor({
  viewportPx,
  coveredPx,
  usualPx,
  headerPx
}: GraphRoom): number {
  if (!(coveredPx > 0)) {
    return usualPx;
  }
  const room = viewportPx - coveredPx - headerPx;
  return Math.max(MIN_GRAPH_CARD, Math.min(usualPx, Math.round(room)));
}
