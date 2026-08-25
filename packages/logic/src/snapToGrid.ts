/**
 * Landing an edited note on the grid (INV-NOTES-143).
 *
 * Bars snapped and notes did not, which was never a decision: the bar drag
 * was written against a grid and the note edits against milliseconds. So a
 * take could not be tidied onto its own grid, and a bar could not be placed
 * anywhere but on it.
 *
 * Applied to what was edited and to nothing else. A note nobody touched keeps
 * exactly where it was sung — quantising the whole take because one note
 * moved would be an edit nobody asked for.
 */
import type { NoteEvent } from './segmentation';

/** Never shorter than this, so snapping cannot collapse a note to nothing. */
const MIN_NOTE_MS = 40;

/** The nearest grid moment to `atMs`, on a grid of `stepMs` from `offsetMs`. */
export function nearestStepMs(
  atMs: number,
  stepMs: number,
  offsetMs = 0
): number {
  if (!(stepMs > 0)) {
    return atMs;
  }
  return offsetMs + Math.round((atMs - offsetMs) / stepMs) * stepMs;
}

/**
 * Put the chosen notes on the grid, start and end.
 *
 * Both edges, because a note that begins on the beat and ends between two is
 * only half tidied — and the length is what the eye reads on a piano roll.
 */
export function snapNotes(
  notes: readonly NoteEvent[],
  chosen: readonly number[],
  stepMs: number,
  offsetMs = 0
): NoteEvent[] {
  const wanted = new Set(chosen);
  if (!(stepMs > 0) || wanted.size === 0) {
    return [...notes];
  }
  return notes.map((note, i) => {
    if (!wanted.has(i)) {
      return note;
    }
    const startMs = Math.max(0, nearestStepMs(note.startMs, stepMs, offsetMs));
    const endMs = nearestStepMs(note.endMs, stepMs, offsetMs);
    // A note snapped to a single step is a note that lost its length; the
    // shortest it may become is one step.
    return {
      ...note,
      startMs,
      endMs: Math.max(startMs + Math.max(MIN_NOTE_MS, stepMs), endMs)
    };
  });
}
