/**
 * useDragAudition — hearing a note while it is being moved.
 *
 * Moving a note is a question about pitch, and answering it by eye alone
 * means dropping the note and pressing a control to find out — by which point
 * the thing being compared is gone. Sounding the pitch under the finger makes
 * the drag its own audition (INV-NOTES-070).
 *
 * A toggle, because a phone speaker in a quiet room is not always welcome and
 * a drag across an octave is twelve notes nobody asked for. Its own level too:
 * it fires far more often than a tap and wants to sit under one.
 *
 * Split from useNotePlayback, which was over its line budget and is about the
 * take rather than about editing it.
 */
import { useCallback, useState } from 'react';

import { transposeMidi } from 'logic';

/**
 * How long a pitch sounds as a drag crosses it.
 *
 * Short on purpose: a sweep across an octave is twelve of these, and anything
 * longer stacks them into a chord.
 */
const DRAG_NOTE_MS = 160;

/** What the drag audition starts at, against the audition voice's own level. */
export const DEFAULT_DRAG_LEVEL = 0.6;

/** The one thing this needs of a player: sound these notes, at this level. */
export interface AuditionVoice {
  play: (targets: readonly { midi: number; startMs: number; endMs: number }[]) => void;
  setLevel: (level: number) => void;
}

export function useDragAudition(voice: AuditionVoice, octaves: number) {
  const [isDragAudible, setIsDragAudible] = useState(true);
  const [dragLevel, setDragLevel] = useState(DEFAULT_DRAG_LEVEL);

  /** One semitone, as the finger reaches it. Silent when turned off. */
  const hearDragged = useCallback(
    (midi: number) => {
      if (!isDragAudible) {
        return;
      }
      // Shifted like everything else that sounds, or a drag would be checked
      // against a different note from the one playback gives (INV-NOTES-058).
      voice.setLevel(dragLevel);
      voice.play([
        { midi: transposeMidi(midi, octaves), startMs: 0, endMs: DRAG_NOTE_MS }
      ]);
    },
    [isDragAudible, dragLevel, voice, octaves]
  );

  return {
    hearDragged,
    isDragAudible,
    setIsDragAudible,
    dragLevel,
    setDragLevel
  };
}

export default useDragAudition;
