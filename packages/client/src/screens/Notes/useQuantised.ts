/**
 * Whether this take is being read as it was sung or as it would be
 * written down (INV-NOTES-202).
 *
 * Kept with the take rather than held in a component, and one setting
 * rather than one per surface. It was a playback-only choice in component
 * state, so the graph went on drawing what was sung while the ear heard it
 * tidied, and the export ignored the question entirely — three surfaces
 * disagreeing about which reading is in force, which is worse than none of
 * them offering the choice.
 *
 * Off to begin with. What somebody sang is what they came back to hear,
 * and the tidied reading is the thing being judged against it.
 */
import { useCallback, useEffect, useState } from 'react';

import { getJSON, setJSON } from '../../data/store';

const ON_BY_DEFAULT = false;

const keyFor = (noteId: string) => `notes.${noteId}.quantised`;

function read(noteId: string | null): boolean {
  if (noteId == null) {
    return ON_BY_DEFAULT;
  }
  return getJSON<boolean>(keyFor(noteId)) ?? ON_BY_DEFAULT;
}

export interface UseQuantised {
  isQuantised: boolean;
  setQuantised: (on: boolean) => void;
}

export function useQuantised(noteId: string | null): UseQuantised {
  const [isQuantised, setState] = useState(() => read(noteId));

  // A different take is a different answer, so this follows the note rather
  // than keeping whatever the last one was set to.
  useEffect(() => setState(read(noteId)), [noteId]);

  const setQuantised = useCallback(
    (on: boolean) => {
      setState(on);
      if (noteId != null) {
        setJSON(keyFor(noteId), on);
      }
    },
    [noteId]
  );

  return { isQuantised, setQuantised };
}

export default useQuantised;
