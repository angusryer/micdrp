/**
 * The harmony: the chords, read from the transcription grouped by the
 * rhythm and corrected by hand (INV-NOTES-255).
 *
 * The only layer whose inference reads the rhythm, and the one a person
 * will edit most. Inference first, then their decisions on top of it —
 * which is what makes what is stored differences rather than a copy
 * (INV-NOTES-022): a slot nobody overrode follows the analysis, a slot
 * somebody chose does not.
 *
 * Nothing until somebody asks (INV-NOTES-171). The chords used to appear on
 * their own, built on a tempo nobody had confirmed — the app asserting the
 * harmony of an idea before its author had said what the beat was.
 */
import { harmonizeToGrid, type ChordSlot } from '../harmony';
import { replayEdits } from '../interpretation';
import { detectKey, type KeyEstimate } from '../key';
import { relabelFromNotes } from '../chordEdits';
import type { NoteEvent } from '../segmentation';
import { VOICING_BOTTOM_MIDI } from '../voicing';
import type { Rhythm } from './rhythm';
import type { HarmonySlice } from './slices';
import type { Transcription } from './transcription';

export interface HarmonyInputs {
  /** A bass layer sung against the take, which names the roots. */
  bass?: readonly NoteEvent[];
  /** The lowest pitch a voicing may use. */
  floorMidi?: number;
}

export interface Harmony {
  key: KeyEstimate;
  /** What the analysis said, before any statement. */
  inferred: ChordSlot[];
  /** The chords in force: inferred, with every kept edit replayed. */
  slots: ChordSlot[];
}

export function deriveHarmony(
  transcription: Transcription,
  rhythm: Rhythm,
  slice: HarmonySlice,
  inputs: HarmonyInputs = {}
): Harmony {
  // The tune, never the count: a sung count states a tempo and implies no
  // harmony (INV-NOTES-113).
  const melody = transcription.played;
  const floorMidi = inputs.floorMidi ?? VOICING_BOTTOM_MIDI;
  const key = detectKey(melody);
  const inferred = slice.isWanted
    ? harmonizeToGrid(melody, rhythm.grid, {
        key,
        downbeatSteps: rhythm.bars.lines,
        bass: inputs.bass
      })
    : [];
  // Relabelled from the notes after replaying, not just when the edit was
  // made: a moved note kept sounding but its name reverted the instant the
  // edit round-tripped through storage (INV-NOTES-036).
  const slots = (slice.chords.length ? replayEdits(inferred, slice.chords, key) : inferred).map(
    (slot) => relabelFromNotes(slot, key, floorMidi)
  );
  return { key, inferred, slots };
}
