/**
 * Editable chord backdrop for a note's melody.
 *
 * Holds the inferred progression and the user's changes to it side by side, so
 * a slot can always be put back to what the melody implied. Every edit goes
 * through a pure `logic` transform; this hook only decides which slot the
 * gesture landed on and remembers the result.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { rootsOnly, withoutRoot } from './chordVoices';
import { AUDITION_MS, VOICING_BOTTOM_MIDI } from './chordTrackDefaults';

import {
  collectEdits,
  cycleQuality,
  detectKey,
  harmonizeToGrid,
  relabelFromNotes,
  replayEdits,
  resetChordTone,
  revertSlot,
  transposeDiatonic,
  isAltered,
  moveChordTone,
  toggleMute as toggleVoicedMute,
  voiceChord,
  voiceProgression,
  type ChordPlayback,
  type ChordSlot,
  type ChordSlotEdit,
  type MusicalGrid,
  type NoteEvent
} from 'logic';

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
  /** Put one note of one chord back where the chord itself would have it. */
  resetTone: (index: number, tone: number) => void;
  /**
   * The root of each chord on its own, so it can be mixed as a bass under the
   * rest of the harmony rather than as another note inside it (INV-NOTES-040).
   * Empty for a slot whose root has been silenced — one decision about
   * whether a root sounds, not two.
   */
  bass: ChordPlayback[];
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
  /**
   * Where the downbeats are, as grid steps. Each one opens a chord and the
   * chord runs to the next, so the number of chords and their lengths are
   * the singer's rather than the metre's (INV-NOTES-048).
   */
  downbeatSteps?: readonly number[];
  /**
   * A bass layer sung against the take, when there is one. It names the root
   * of each chord, which a melody alone can only imply (INV-NOTES-071).
   */
  bassLayer?: readonly NoteEvent[];
  /**
   * Whether anybody has asked for the harmony (INV-NOTES-171).
   *
   * False produces no slots at all. Defaulted true so a caller that has no
   * opinion — the dogfood player, a test — behaves as before.
   */
  isWanted?: boolean;
}

export function useChordTrack(
  melody: readonly NoteEvent[],
  grid: MusicalGrid,
  options: ChordTrackOptions = {}
): ChordTrack {
  const {
    savedEdits,
    onEditsChanged,
    floorMidi = VOICING_BOTTOM_MIDI,
    downbeatSteps,
    bassLayer,
    isWanted = true
  } = options;
  const key = useMemo(() => detectKey(melody), [melody]);
  // Nothing until somebody asks. The chords used to appear on their own,
  // built on a tempo nobody had confirmed and a metre nobody had stated —
  // the app asserting the harmony of an idea before its author had said
  // what the beat was (INV-NOTES-171).
  const inferred = useMemo(
    () =>
      isWanted
        ? harmonizeToGrid(melody, grid, { key, downbeatSteps, bass: bassLayer })
        : [],
    [isWanted, melody, grid, key, downbeatSteps, bassLayer]
  );

  // Inference first, then a person's decisions on top of it — which is what
  // makes what we store differences rather than a copy (INV-NOTES-022). A
  // slot nobody overrode follows the analysis; a slot someone chose does not.
  // Relabelled from the notes after replaying, not just when the edit was
  // made. replayEdits names a slot from its root and quality — the spine —
  // so without this a moved note kept sounding but the name reverted the
  // instant the edit round-tripped through storage (INV-NOTES-036).
  const restored = useMemo(
    () =>
      (savedEdits?.length
        ? replayEdits(inferred, savedEdits, key)
        : inferred
      ).map((slot) => relabelFromNotes(slot, key, floorMidi)),
    [inferred, savedEdits, key, floorMidi]
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
  // play is the chord that plays. The root is taken out and handed to its own
  // bus, so the backdrop above it is the harmony and the bass is the ground it
  // stands on (INV-NOTES-040).
  const progression = useMemo(
    () => withoutRoot(voiceProgression(slots, { bottomMidi: floorMidi }), slots, floorMidi),
    [slots, floorMidi]
  );
  const bass = useMemo(() => rootsOnly(slots, floorMidi), [slots, floorMidi]);

  return {
    slots,
    progression,
    bass,
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
        // Renames the slot to whatever the notes now spell, so the card above
        // says what is actually sounding (INV-NOTES-036).
        apply(index, (slot) =>
          moveChordTone(slot, key, tone, semitones, floorMidi)
        ),
      [apply, key, floorMidi]
    ),
    resetTone: useCallback(
      (index, tone) =>
        apply(index, (slot) => resetChordTone(slot, key, tone, floorMidi)),
      [apply, key, floorMidi]
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
