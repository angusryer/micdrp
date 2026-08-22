/**
 * An editable harmonic backdrop for a sung line.
 *
 * `impliedHarmony` answers "what chord does this stretch of melody imply?" over
 * fixed-length windows. That is the right question for corpus statistics and
 * the wrong one for someone shaping an idea: a 2000ms window cuts across bar
 * lines, so the chords it returns cannot be placed on a chart, played back as
 * a progression, or edited as musical objects.
 *
 * This module puts chords ON THE GRID — one slot per bar, or per half bar —
 * and makes them editable. Each slot carries the inferred chord, whether it
 * was inferred or chosen by hand, and how strongly the melody supported it.
 *
 * The editing operations are all pure functions returning new slots, which is
 * what makes undo, comparison and "try it and hear it" cheap for a caller.
 *
 * The important choice here is that dragging a chord moves it DIATONICALLY by
 * default. Chromatic motion is available, but a singer exploring a backdrop
 * for their own melody almost always wants the next chord in the key, not the
 * one a semitone up; offering twelve steps where seven are wanted turns a
 * one-gesture change into a fiddly one.
 *
 * Pure, dependency-free, ES5-safe Math only.
 */

import {
  absoluteLabel,
  impliedHarmony,
  romanLabel,
  type ChordQuality,
  type Melody
} from './analysis';
import { CHORD_TONES } from './chordTones';
import { voicedTones, type ChordVoicing } from './voicing';
import { detectKey, type KeyEstimate } from './key';
import type { MusicalGrid } from './quantize';

/**
 * The order a "change the shape" control steps through.
 *
 * Ordered by how far each sits from a plain major triad, so a single step is
 * a small musical change rather than a jump from major to half-diminished.
 */
export const QUALITY_CYCLE: readonly ChordQuality[] = [
  'maj',
  'min',
  'maj7',
  'dom7',
  'min7',
  'dim',
  'm7b5',
  'aug',
  'dim7'
];

/** Major and natural-minor scale degrees, as semitones from the tonic. */
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** The triad quality built on each scale degree. */
const MAJOR_DEGREE_QUALITY: readonly ChordQuality[] = [
  'maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'
];
const MINOR_DEGREE_QUALITY: readonly ChordQuality[] = [
  'min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'
];

export interface ChordSlot {
  /** 1-based bar this slot begins in. */
  bar: number;
  /** Slot start and end on the grid, in ms. */
  startMs: number;
  endMs: number;
  /** Chord root pitch class, 0..11. */
  rootPc: number;
  quality: ChordQuality;
  /** Absolute label, e.g. "C", "Am7". */
  label: string;
  /** Roman-numeral label relative to the key, e.g. "V7". */
  roman: string;
  /** 0..1 support from the melody. Zero once the user has chosen the chord. */
  confidence: number;
  /** True once a person has changed this slot, so inference stops overwriting it. */
  isEdited: boolean;
  /**
   * How this slot's individual notes have been moved or silenced, if at all.
   * The chord itself stays (rootPc, quality) — this is the layer over it, so
   * the label and roman numeral survive every voicing change (INV-NOTES-036).
   */
  voicing?: ChordVoicing;
}

export interface HarmonizeOptions {
  /** Chords per bar (default 1). Two gives a chord on each half bar. */
  chordsPerBar?: number;
  /** Chord set to infer from (default 'triads'). */
  vocabulary?: 'triads' | 'sevenths';
  /** Precomputed key; detected from the melody when omitted. */
  key?: KeyEstimate;
}

function normalizePc(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

/** The pitch classes a chord is built from. */
export function chordTones(rootPc: number, quality: ChordQuality): number[] {
  const root = normalizePc(rootPc);
  return CHORD_TONES[quality].map(function (offset) {
    return normalizePc(root + offset);
  });
}

function relabel(slot: ChordSlot, key: KeyEstimate): ChordSlot {
  return {
    ...slot,
    label: absoluteLabel(slot.rootPc, slot.quality),
    roman: romanLabel(slot.rootPc, slot.quality, key)
  };
}

/**
 * Lay an inferred chord progression over the bars of a fitted grid.
 *
 * Each slot spans exactly one bar (or a fraction of one), so the result can be
 * drawn as a chart, stepped through, and played. Chords are inferred by
 * running the existing window matcher at the slot length, which keeps one
 * implementation of "what chord is this" rather than two.
 */
export function harmonizeToGrid(
  notes: Melody,
  grid: MusicalGrid,
  options: HarmonizeOptions = {}
): ChordSlot[] {
  if (notes.length === 0 || grid.bpm <= 0) {
    return [];
  }
  const chordsPerBar = Math.max(1, Math.round(options.chordsPerBar ?? 1));
  const beatMs = 60000 / grid.bpm;
  const barMs = beatMs * grid.beatsPerBar;
  const slotMs = barMs / chordsPerBar;
  const key = options.key ?? detectKey(notes);

  let endOfMelody = 0;
  let startOfMelody = Infinity;
  for (const n of notes) {
    if (n.endMs > endOfMelody) {
      endOfMelody = n.endMs;
    }
    if (n.startMs < startOfMelody) {
      startOfMelody = n.startMs;
    }
  }

  // Walk the grid's own bar lines rather than the melody's start, so slots line
  // up with the bar lines already drawn behind the notes.
  const firstSlot = Math.floor((startOfMelody - grid.offsetMs) / slotMs);
  const lastSlot = Math.ceil((endOfMelody - grid.offsetMs) / slotMs) - 1;

  const inferred = impliedHarmony(notes, {
    windowMs: slotMs,
    hopMs: slotMs,
    vocabulary: options.vocabulary ?? 'triads',
    key
  });

  const slots: ChordSlot[] = [];
  for (let index = firstSlot; index <= lastSlot; index++) {
    const startMs = grid.offsetMs + index * slotMs;
    const endMs = startMs + slotMs;
    // The window matcher runs from zero, so pick the estimate that overlaps
    // this slot most rather than assuming the two are index-aligned.
    let best: (typeof inferred)[number] | null = null;
    let bestOverlap = 0;
    for (const estimate of inferred) {
      const overlap =
        Math.min(estimate.endMs, endMs) - Math.max(estimate.startMs, startMs);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = estimate;
      }
    }
    if (!best) {
      continue;
    }
    slots.push(
      relabel(
        {
          bar: Math.floor(index / chordsPerBar) + 1,
          startMs: Math.round(startMs),
          endMs: Math.round(endMs),
          rootPc: best.rootPc,
          quality: best.quality,
          label: '',
          roman: '',
          confidence: best.confidence,
          isEdited: false
        },
        key
      )
    );
  }
  return slots;
}

// ── Editing ────────────────────────────────────────────────────────────────

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
 * Return a slot to what the melody implies, discarding a hand edit.
 *
 * Takes the original inferred slot rather than recomputing, so a caller can
 * offer a revert without holding onto the whole analysis.
 */
export function revertSlot(edited: ChordSlot, inferred: ChordSlot): ChordSlot {
  return { ...inferred, startMs: edited.startMs, endMs: edited.endMs };
}

// ── Voicing ────────────────────────────────────────────────────────────────

/** Where a chord should sound, as a MIDI note range. */
export interface VoicingOptions {
  /**
   * Lowest MIDI note the voicing may use (default 48, the C below middle C).
   * A backdrop under a sung line wants to sit below it without booming.
   */
  bottomMidi?: number;
  /** 0 for root position, 1 for first inversion, and so on. */
  inversion?: number;
  /**
   * Per-note offsets and silences. Silenced notes are left out of what
   * sounds while staying in the slot, so they can be brought back
   * (INV-NOTES-037).
   */
  voicing?: ChordVoicing;
}

/**
 * Turn a chord into MIDI notes to play.
 *
 * Voiced upward from `bottomMidi` so successive chords stay in one register
 * instead of leaping an octave whenever the root crosses B to C.
 */
export function voiceChord(
  rootPc: number,
  quality: ChordQuality,
  options: VoicingOptions = {}
): number[] {
  const bottom = options.bottomMidi ?? 48;
  const inversion = Math.max(0, Math.round(options.inversion ?? 0));

  // Absolute pitches in root position, starting at or above `bottom`.
  const root = normalizePc(rootPc);
  const rootMidi = bottom + normalizePc(root - normalizePc(bottom));
  const notes: number[] = [];
  for (const tone of voicedTones(rootMidi, quality, options.voicing)) {
    if (!tone.muted) {
      notes.push(tone.midi);
    }
  }
  if (notes.length === 0) {
    // Every note silenced: the slot is still there, it just says nothing.
    return notes;
  }

  // Sorted before inverting, because an offset can put a tone below the one
  // under it and "lift the lowest" has to mean the lowest that is sounding.
  notes.sort(function (a, b) {
    return a - b;
  });
  for (let i = 0; i < inversion % notes.length; i++) {
    notes[i] += 12;
  }
  notes.sort(function (a, b) {
    return a - b;
  });
  return notes;
}

/** A progression as playable events, one per slot. */
export interface ChordPlayback {
  midi: number[];
  startMs: number;
  endMs: number;
}

/** Voice a whole progression for playback under the melody. */
export function voiceProgression(
  slots: readonly ChordSlot[],
  options: VoicingOptions = {}
): ChordPlayback[] {
  return slots.map(function (slot) {
    return {
      midi: voiceChord(slot.rootPc, slot.quality, {
        ...options,
        voicing: slot.voicing
      }),
      startMs: slot.startMs,
      endMs: slot.endMs
    };
  });
}
