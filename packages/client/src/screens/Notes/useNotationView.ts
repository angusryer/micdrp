/**
 * Which reading of a take is on screen — as sung, or as written down.
 *
 * Held apart from the playback choice on purpose (INV-NOTES-026): looking at
 * the notation while listening to the raw take is how a person tells whether a
 * wrong note is the detector's doing or the quantizer's, and one control
 * driving both would take that comparison away.
 *
 * The reading is a view of the melody, never an edit of it: nothing here
 * writes, so a note is the same note whichever way it is being read.
 */
import { useMemo, useState } from 'react';

import {
  shownNotes,
  type NoteEvent,
  type NotationView,
  type QuantizedNote
} from 'logic';

export interface NotationViewState {
  /** The reading in force — never 'as-notated' when there is no grid. */
  view: NotationView;
  setView: (view: NotationView) => void;
  /** The melody as the reading in force draws it. */
  notes: NoteEvent[];
  /** False when the take has no metre, so there is nothing to write against. */
  canNotate: boolean;
}

export function useNotationView(
  melody: readonly NoteEvent[],
  quantized: readonly QuantizedNote[],
  hasGrid: boolean
): NotationViewState {
  const [view, setView] = useState<NotationView>('as-sung');
  const canNotate = hasGrid && quantized.length > 0;
  // A take whose grid goes away must not be left on a reading it can no longer
  // be drawn in — that would show the last snapped picture of a melody that is
  // no longer being snapped.
  const inForce: NotationView = canNotate ? view : 'as-sung';
  const notes = useMemo(
    () => shownNotes(melody, quantized, inForce),
    [melody, quantized, inForce]
  );
  return { view: inForce, setView, notes, canNotate };
}

export default useNotationView;
