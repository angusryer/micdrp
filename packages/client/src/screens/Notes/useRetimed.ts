/**
 * The span of the last edit that changed *when* something happens.
 *
 * Timing is the one thing that cannot be judged from a note alone — a note is
 * early or late against what surrounds it — so a retiming asks to hear the
 * phrase around it (INV-NOTES-178). This says one happened and over what; what
 * to do about it is the view's business.
 */
import { useCallback, useRef, useState } from 'react';

import type { NoteEvent } from 'logic';

export interface Retimed {
  fromMs: number;
  toMs: number;
  /**
   * Which retiming this is, counting from the first.
   *
   * A count rather than a moment, so the same edit made twice reads as two
   * edits — and because a clock read during a render is not a fact about the
   * edit.
   */
  nth: number;
}

export function useRetimed() {
  const [retimed, setRetimed] = useState<Retimed | null>(null);
  const count = useRef(0);

  /**
   * Say a retiming happened, over the span the chosen notes occupy.
   *
   * Read from the melody as it is *before* the edit lands: the edit moves
   * things by a sixteenth or two while the span is padded by the best part of
   * a second either side, so the difference does not show — and waiting for
   * the new melody would mean threading it through a render.
   */
  const markRetimed = useCallback(
    (chosen: readonly number[], notes: readonly NoteEvent[]) => {
      const touched = chosen.flatMap((i) => (notes[i] ? [notes[i]] : []));
      if (touched.length === 0) {
        return;
      }
      count.current += 1;
      setRetimed({
        fromMs: Math.min(...touched.map((n) => n.startMs)),
        toMs: Math.max(...touched.map((n) => n.endMs)),
        nth: count.current
      });
    },
    []
  );

  return { retimed, markRetimed };
}
