/**
 * The order takes are listed in (INV-NOTES-271).
 *
 * Newest first, except that a favourite is always above one that is not.
 * A person favourites a take to keep it to hand, and a list that then
 * buried it under this morning's humming would be answering a different
 * question from the one they asked.
 *
 * Within each group, still newest first: favouriting says which takes
 * matter, never which order they matter in.
 */
export interface Listable {
  id: string;
  createdAtMs: number;
}

export function orderedNotes<T extends Listable>(
  notes: readonly T[],
  isFavourite: (id: string) => boolean
): T[] {
  return [...notes].sort((a, b) => {
    const favA = isFavourite(a.id);
    const favB = isFavourite(b.id);
    if (favA !== favB) {
      return favA ? -1 : 1;
    }
    return b.createdAtMs - a.createdAtMs;
  });
}
