/**
 * Editable chord backdrop for a note's melody.
 *
 * Holds the inferred progression and the user's changes to it side by side, so
 * a slot can always be put back to what the melody implied. Every edit goes
 * through a pure `logic` transform; this hook only decides which slot the
 * gesture landed on and remembers the result.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  cycleQuality,
  detectKey,
  harmonizeToGrid,
  revertSlot,
  transposeDiatonic,
  voiceChord,
  voiceProgression,
  type ChordPlayback,
  type ChordSlot,
  type MusicalGrid,
  type NoteEvent
} from 'logic';

/** How long a chord sounds when tapped, in ms. */
const AUDITION_MS = 1100;
/** Sits below a sung line without booming under it. */
const VOICING_BOTTOM_MIDI = 48;

export interface ChordTrack {
  slots: ChordSlot[];
  /** True when any slot has been changed by hand. */
  hasEdits: boolean;
  /** Move a chord through the key by whole scale degrees. */
  nudge: (index: number, degrees: number) => void;
  /** Step a chord's shape, keeping its root. */
  reshape: (index: number, step: number) => void;
  /** Put one slot back to what the melody implied. */
  revert: (index: number) => void;
  /** Put every slot back. */
  revertAll: () => void;
  /** MIDI notes for a slot, for playback. */
  voicing: (index: number) => number[];
  /**
   * The whole track voiced on the melody's own clock, for sounding under a
   * take. Same floor as {@link voicing}, so what plays under the take is what
   * an audition of each slot would give.
   */
  progression: ChordPlayback[];
  auditionMs: number;
}

export function useChordTrack(
  melody: readonly NoteEvent[],
  grid: MusicalGrid
): ChordTrack {
  const key = useMemo(() => detectKey(melody), [melody]);
  const inferred = useMemo(
    () => harmonizeToGrid(melody, grid, { key }),
    [melody, grid, key]
  );
  const [slots, setSlots] = useState<ChordSlot[]>(inferred);

  // Re-inferring replaces the working copy. Edits are deliberately not carried
  // across: that only happens when the melody or the grid itself changed, at
  // which point the old slots describe a different set of bars.
  useEffect(() => {
    setSlots(inferred);
  }, [inferred]);

  const apply = useCallback(
    (index: number, change: (slot: ChordSlot) => ChordSlot) => {
      setSlots((current) =>
        current.map((slot, i) => (i === index ? change(slot) : slot))
      );
    },
    []
  );

  // Voiced here rather than at the player, so an edit made before pressing
  // play is the chord that plays.
  const progression = useMemo(
    () => voiceProgression(slots, { bottomMidi: VOICING_BOTTOM_MIDI }),
    [slots]
  );

  return {
    slots,
    progression,
    hasEdits: slots.some((s) => s.isEdited),
    nudge: useCallback(
      (index, degrees) =>
        apply(index, (slot) => transposeDiatonic(slot, key, degrees)),
      [apply, key]
    ),
    reshape: useCallback(
      (index, step) => apply(index, (slot) => cycleQuality(slot, key, step)),
      [apply, key]
    ),
    revert: useCallback(
      (index) =>
        apply(index, (slot) =>
          inferred[index] ? revertSlot(slot, inferred[index]) : slot
        ),
      [apply, inferred]
    ),
    revertAll: useCallback(() => setSlots(inferred), [inferred]),
    voicing: useCallback(
      (index) => {
        const slot = slots[index];
        return slot
          ? voiceChord(slot.rootPc, slot.quality, {
              bottomMidi: VOICING_BOTTOM_MIDI
            })
          : [];
      },
      [slots]
    ),
    auditionMs: AUDITION_MS
  };
}

export default useChordTrack;
