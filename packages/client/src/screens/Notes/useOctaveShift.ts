/**
 * useOctaveShift — which register the melody is being listened to in.
 *
 * A phone speaker has almost nothing low down, so a line sung there cannot be
 * judged on one. This moves what sounds and nothing else: not the graph, not
 * the reading held for the note, not the export (INV-NOTES-058).
 *
 * Held for the screen rather than kept with the note, like the rest of the
 * listening controls. It answers "what am I holding this to my ear on right
 * now", which is not a property of the take.
 */
import { useCallback, useMemo, useState } from 'react';

import { octaveRoom, type NoteEvent } from 'logic';

/**
 * The most octaves offered in either direction.
 *
 * Three is already past useful — a melody moved that far is a different
 * instrument rather than the same line somewhere audible — and the MIDI range
 * usually narrows it further.
 */
export const OCTAVE_LIMIT = 3;

export function useOctaveShift(melody: readonly NoteEvent[]) {
  const [octaves, setOctaves_] = useState(0);

  // Only the shifts that leave every note inside MIDI range. Clamping the
  // ones that would fall off the end would flatten the intervals and play
  // something that was never sung (INV-NOTES-059).
  const octaveRange = useMemo(
    () => octaveRoom(melody.map((note) => note.midi), OCTAVE_LIMIT),
    [melody]
  );

  const shiftOctave = useCallback(
    (by: number) =>
      setOctaves_((current) => {
        const wanted = current + by;
        return wanted > octaveRange.up || wanted < -octaveRange.down
          ? current
          : wanted;
      }),
    [octaveRange]
  );

  /** Go straight to a register, held inside what keeps notes in range. */
  const setOctaves = useCallback(
    (wanted: number) =>
      setOctaves_(Math.max(-octaveRange.down, Math.min(octaveRange.up, wanted))),
    [octaveRange]
  );

  return { octaves, octaveRange, shiftOctave, setOctaves };
}

export default useOctaveShift;
