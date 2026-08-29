/**
 * Whether this note's melody is also shown on a guitar neck (INV-NOTES-151).
 *
 * Kept with the note like the rest of how a note is listened to
 * (INV-NOTES-114): it answers "is this idea one I am working out on an
 * instrument", which is about the idea rather than about the app.
 *
 * Its own key rather than a field on `useListening`, which is at its file
 * budget and would have to grow to carry it. Two hooks writing one blob would
 * clobber each other, so it gets a key of its own instead (Axiom 3).
 */
import { useCallback, useEffect, useState } from 'react';

import { getJSON, setJSON } from '../../data/store';

/** Shown before anybody chooses: a neck nobody knows about is not offered. */
const SHOWN_BY_DEFAULT = true;

const keyFor = (noteId: string) => `notes.${noteId}.neckShown`;

function read(noteId: string | null): boolean {
  if (noteId == null) {
    return SHOWN_BY_DEFAULT;
  }
  return getJSON<boolean>(keyFor(noteId)) ?? SHOWN_BY_DEFAULT;
}

export interface UseNeckShown {
  neckShown: boolean;
  setNeckShown: (shown: boolean) => void;
}

export function useNeckShown(noteId: string | null): UseNeckShown {
  const [neckShown, setShown] = useState<boolean>(() => read(noteId));

  // Read rather than carried over, so opening a second note never inherits
  // the first note's answer.
  useEffect(() => setShown(read(noteId)), [noteId]);

  const setNeckShown = useCallback(
    (shown: boolean) => {
      setShown(shown);
      if (noteId != null) {
        setJSON(keyFor(noteId), shown);
      }
    },
    [noteId]
  );

  return { neckShown, setNeckShown };
}

export default useNeckShown;
