/**
 * chordEdits — the pure transforms behind changing one chord.
 *
 * Split from harmonize, which reads chords out of a melody; this changes one
 * a person has in front of them. Every function returns a new slot, which is
 * what makes undo, comparison and "try it and hear it" cheap for a caller.
 *
 * Dragging a chord moves it DIATONICALLY by default. Chromatic motion is
 * available, but a singer exploring a backdrop for their own melody almost
 * always wants the next chord in the key, not the one a semitone up; offering
 * twelve steps where seven are wanted turns a one-gesture change into a
 * fiddly one.
 */
import { absoluteLabel, romanLabel, type ChordQuality } from './analysis';
import { identifyChord } from './identifyChord';
import type { KeyEstimate } from './key';
import {
  moveTone as moveVoicedTone,
  resetTone as resetVoicedTone,
  rootMidiAtOrAbove,
  voicedTones
} from './voicing';
import {
  MAJOR_DEGREE_QUALITY,
  MAJOR_SCALE,
  MINOR_DEGREE_QUALITY,
  MINOR_SCALE,
  normalizePc,
  QUALITY_CYCLE,
  relabel,
  type ChordSlot
} from './chordSlot';


function scaleOf(key: KeyEstimate): readonly number[] {
  return key.mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
}

function degreeQualityOf(key: KeyEstimate): readonly ChordQuality[] {
  return key.mode === 'minor' ? MINOR_DEGREE_QUALITY : MAJOR_DEGREE_QUALITY;
}

/**
 * Which scale degree a root sits on, or -1 when it is outside the key.
 */
export function scaleDegreeOf(rootPc: number, key: KeyEstimate): number {
  const offset = normalizePc(rootPc - key.tonic);
  return scaleOf(key).indexOf(offset);
}

/**
 * Move a chord by scale degrees, staying in the key.
 *
 * The quality follows the degree, so dragging up from the tonic of a major key
 * gives ii rather than a major chord on the second degree — which is what
 * makes a drag feel like it is moving through the key rather than sliding a
 * shape around.
 *
 * A chord already outside the key has no degree to step from, so it moves
 * chromatically instead and keeps its quality.
 */
export function transposeDiatonic(
  slot: ChordSlot,
  key: KeyEstimate,
  degrees: number
): ChordSlot {
  if (degrees === 0) {
    return slot;
  }
  const scale = scaleOf(key);
  const degree = scaleDegreeOf(slot.rootPc, key);
  if (degree < 0) {
    return transposeChromatic(slot, key, degrees);
  }
  const next = ((degree + degrees) % 7 + 7) % 7;
  const rootPc = normalizePc(key.tonic + scale[next]);
  return relabel(
    { ...slot, rootPc, quality: degreeQualityOf(key)[next], isEdited: true },
    key
  );
}

/** Move a chord by semitones, keeping its shape. */
export function transposeChromatic(
  slot: ChordSlot,
  key: KeyEstimate,
  semitones: number
): ChordSlot {
  if (semitones === 0) {
    return slot;
  }
  return relabel(
    { ...slot, rootPc: normalizePc(slot.rootPc + semitones), isEdited: true },
    key
  );
}

/** Step the chord's shape through {@link QUALITY_CYCLE}, keeping its root. */
export function cycleQuality(
  slot: ChordSlot,
  key: KeyEstimate,
  step: number
): ChordSlot {
  const current = QUALITY_CYCLE.indexOf(slot.quality);
  const from = current < 0 ? 0 : current;
  const length = QUALITY_CYCLE.length;
  const next = ((from + step) % length + length) % length;
  return relabel(
    { ...slot, quality: QUALITY_CYCLE[next], isEdited: true },
    key
  );
}

/** Set a chord outright, e.g. from a picker. */
export function setChord(
  slot: ChordSlot,
  key: KeyEstimate,
  rootPc: number,
  quality: ChordQuality
): ChordSlot {
  return relabel(
    { ...slot, rootPc: normalizePc(rootPc), quality, isEdited: true },
    key
  );
}

/**
 * Move one of a chord's notes.
 *
 * The three notes are stable things you push around, and each keeps its
 * place in the chord's list however far it travels — which is what lets a
 * colour stay attached to it and makes dragging predictable (INV-NOTES-052).
 * So the root and quality do not move: they are where this chord came from,
 * and reordering them under the finger would renumber the notes mid-drag.
 *
 * What does follow the notes is the name. Whatever they now spell is what the
 * slot is called, so pulling the third of a C down says Cm — the chord is
 * read from the notes rather than asserted over them (INV-NOTES-036). Notes
 * that spell nothing keep the last name and wear the move as an alteration,
 * which says "you invented this" rather than guessing what was meant.
 *
 * An earlier version rewrote root and quality outright and cleared the
 * voicing. That renumbered the notes, so a colour jumped from one to another
 * as the name changed — and, worse, re-voicing from the floor moved the whole
 * chord by an octave under the finger.
 */
export function moveChordTone(
  slot: ChordSlot,
  key: KeyEstimate,
  toneIndex: number,
  semitones: number,
  floorMidi: number
): ChordSlot {
  const moved = moveVoicedTone(slot.voicing, slot.quality, toneIndex, semitones);
  return relabelFromNotes({ ...slot, voicing: moved, isEdited: true }, key, floorMidi);
}

/**
 * Put one of a chord's notes back where the chord would have it.
 *
 * The name follows, since the notes have changed and the name is read from
 * them — resetting the note that made a C into a Cm makes it a C again.
 */
export function resetChordTone(
  slot: ChordSlot,
  key: KeyEstimate,
  toneIndex: number,
  floorMidi: number
): ChordSlot {
  const voicing = resetVoicedTone(slot.voicing, slot.quality, toneIndex);
  return relabelFromNotes({ ...slot, voicing, isEdited: true }, key, floorMidi);
}

/**
 * Name a slot after the notes it is actually sounding.
 *
 * Silenced notes are left out: a chord is what you can hear, and naming it
 * after something inaudible would describe the wrong thing.
 */
export function relabelFromNotes(
  slot: ChordSlot,
  key: KeyEstimate,
  floorMidi: number
): ChordSlot {
  const rootMidi = rootMidiAtOrAbove(slot.rootPc, floorMidi);
  const sounding = voicedTones(rootMidi, slot.quality, slot.voicing)
    .filter((t) => !t.muted)
    .map((t) => t.midi);
  if (sounding.length === 0) {
    return slot;
  }
  const lowest = Math.min(...sounding);
  const named = identifyChord(sounding, ((lowest % 12) + 12) % 12);
  if (!named) {
    // Spells nothing known: keep the last name rather than invent one.
    return slot;
  }
  return {
    ...slot,
    label: absoluteLabel(named.rootPc, named.quality),
    roman: romanLabel(named.rootPc, named.quality, key)
  };
}

/**
 * Return a slot to what the melody implies, discarding a hand edit.
 *
 * Takes the original inferred slot rather than recomputing, so a caller can
 * offer a revert without holding onto the whole analysis.
 */
export function revertSlot(edited: ChordSlot, inferred: ChordSlot): ChordSlot {
  return { ...inferred, startMs: edited.startMs, endMs: edited.endMs };
}

