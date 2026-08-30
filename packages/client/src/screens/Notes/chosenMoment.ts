/**
 * When the chosen thing happens, for anything that has to look at it.
 *
 * A moment rather than an object, so bringing a choice into view does not need
 * to know what kind of thing was chosen (INV-NOTES-177). Null where a choice
 * has no single moment — a set could be spread across the whole take, and
 * there is no one place to look.
 */
import type { Chosen } from '../../components/graphSelection';
import type { MelodyNote } from '../../components/melodyLayout';

/** Where to look for the one chosen thing, in ms, or null. */
export function chosenMomentMs(
  selection: Chosen,
  notes: readonly MelodyNote[]
): number | null {
  if (selection.length !== 1) {
    return null;
  }
  const one = selection[0];
  if (one?.kind === 'melodyNote' || one?.kind === 'layerNote') {
    const note = notes[one.index];
    // Its middle, so a long note is centred on itself rather than on an edge
    // that may be off the other side of the view.
    return note ? (note.startMs + note.endMs) / 2 : null;
  }
  return null;
}
