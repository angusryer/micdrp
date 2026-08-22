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
  collectEdits,
  cycleQuality,
  detectKey,
  harmonizeToGrid,
  replayEdits,
  revertSlot,
  transposeDiatonic,
  isAltered,
  moveTone as moveVoicedTone,
  toggleMute as toggleVoicedMute,
  voiceChord,
  voiceProgression,
  type ChordPlayback,
  type ChordSlot,
  type ChordSlotEdit,
  type MusicalGrid,
  type NoteEvent
} from 'logic';

/** How long a chord sounds when tapped, in ms. */
const AUDITION_MS = 1100;
/**
 * Sits below a sung line without booming under it — the right register on
 * headphones. A caller listening on the phone's own speaker passes a higher
 * floor, since a built-in speaker has almost nothing down here.
 */
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
  /** Move one note of one chord against its chord tone, in semitones. */
  moveTone: (index: number, tone: number, semitones: number) => void;
  /** Silence one note of one chord, or bring it back. */
  toggleTone: (index: number, tone: number) => void;
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

export interface ChordTrackOptions {
  /** Decisions already kept with the note, replayed onto fresh inference. */
  savedEdits?: readonly ChordSlotEdit[];
  /** Called with the differences whenever they change, for keeping. */
  onEditsChanged?: (edits: ChordSlotEdit[]) => void;
  /**
   * Lowest MIDI note the chords may use. Raising it lifts the whole backdrop
   * towards the melody, which is what makes it audible on a phone speaker.
   */
  floorMidi?: number;
}

export function useChordTrack(
  melody: readonly NoteEvent[],
  grid: MusicalGrid,
  options: ChordTrackOptions = {}
): ChordTrack {
  const { savedEdits, onEditsChanged, floorMidi = VOICING_BOTTOM_MIDI } = options;
  const key = useMemo(() => detectKey(melody), [melody]);
  const inferred = useMemo(
    () => harmonizeToGrid(melody, grid, { key }),
    [melody, grid, key]
  );

  // Inference first, then a person's decisions on top of it — which is what
  // makes what we store differences rather than a copy (INV-NOTES-022). A
  // slot nobody overrode follows the analysis; a slot someone chose does not.
  const restored = useMemo(
    () => (savedEdits?.length ? replayEdits(inferred, savedEdits, key) : inferred),
    [inferred, savedEdits, key]
  );
  const [slots, setSlots] = useState<ChordSlot[]>(restored);

  // Re-inferring replaces the working copy, with saved decisions replayed onto
  // it. Unsaved edits are deliberately not carried across: that only happens
  // when the melody or the grid changed, at which point the old slots describe
  // a different set of bars.
  useEffect(() => {
    setSlots(restored);
  }, [restored]);

  const apply = useCallback(
    (index: number, change: (slot: ChordSlot) => ChordSlot) => {
      setSlots((current) => {
        const next = current.map((slot, i) => (i === index ? change(slot) : slot));
        onEditsChanged?.(collectEdits(next));
        return next;
      });
    },
    [onEditsChanged]
  );

  // Voiced here rather than at the player, so an edit made before pressing
  // play is the chord that plays.
  const progression = useMemo(
    () => voiceProgression(slots, { bottomMidi: floorMidi }),
    [slots]
  );

  return {
    slots,
    progression,
    // A voicing counts: someone can move a note of a chord they were happy
    // with, and the revert-all control has to know there is something to undo.
    hasEdits: slots.some((s) => s.isEdited || isAltered(s.voicing)),
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
    moveTone: useCallback(
      (index, tone, semitones) =>
        apply(index, (slot) => ({
          ...slot,
          voicing: moveVoicedTone(slot.voicing, slot.quality, tone, semitones)
        })),
      [apply]
    ),
    toggleTone: useCallback(
      (index, tone) =>
        apply(index, (slot) => ({
          ...slot,
          voicing: toggleVoicedMute(slot.voicing, slot.quality, tone)
        })),
      [apply]
    ),
    revertAll: useCallback(() => {
      setSlots(inferred);
      onEditsChanged?.([]);
    }, [inferred, onEditsChanged]),
    voicing: useCallback(
      (index) => {
        const slot = slots[index];
        return slot
          ? voiceChord(slot.rootPc, slot.quality, {
              bottomMidi: floorMidi,
              voicing: slot.voicing
            })
          : [];
      },
      [slots]
    ),
    auditionMs: AUDITION_MS
  };
}

export default useChordTrack;
