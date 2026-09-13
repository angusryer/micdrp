/**
 * The takes kept to hand (INV-NOTES-271).
 *
 * On the device rather than with the note. Which takes matter to a person
 * today is a fact about the person, not about the recording — and keeping
 * it here means it works now, rather than after a column exists on the
 * backend to hold it.
 */
import { getJSON, setJSON } from './store';

const KEY = 'notes.favourites';

const read = (): string[] => {
  const stored = getJSON<string[]>(KEY);
  return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
};

export function favourites(): string[] {
  return read();
}

export function isFavourite(noteId: string): boolean {
  return read().includes(noteId);
}

/** Keep it to hand, or stop. Returns what it now is. */
export function setFavourite(noteId: string, wanted: boolean): boolean {
  const was = read();
  if (wanted === was.includes(noteId)) {
    return wanted;
  }
  setJSON(KEY, wanted ? [...was, noteId] : was.filter((id) => id !== noteId));
  return wanted;
}

export function toggleFavourite(noteId: string): boolean {
  return setFavourite(noteId, !isFavourite(noteId));
}
