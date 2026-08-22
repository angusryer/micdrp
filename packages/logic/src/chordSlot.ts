/**
 * chordSlot — one chord placed in time, and the naming both halves share.
 *
 * Extracted so reading chords out of a melody and editing one a person has
 * are separate files that agree about what a chord slot is.
 */
import {
  absoluteLabel,
  romanLabel,
  type ChordQuality
} from './analysis';
import type { KeyEstimate } from './key';
import { CHORD_TONES } from './chordTones';
import type { ChordVoicing } from './voicing';

/**
 * The order a "change the shape" control steps through.
 *
 * Ordered by how far each sits from a plain major triad, so a single step is
 * a small musical change rather than a jump from major to half-diminished.
 */
export const QUALITY_CYCLE: readonly ChordQuality[] = [
  'maj', 'min', 'maj7', 'dom7', 'min7', 'dim', 'm7b5', 'aug', 'dim7'
];

/** Major and natural-minor scale degrees, as semitones from the tonic. */
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** The triad quality built on each scale degree. */
export const MAJOR_DEGREE_QUALITY: readonly ChordQuality[] = [
  'maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'
];
export const MINOR_DEGREE_QUALITY: readonly ChordQuality[] = [
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
   * Cleared whenever the notes come to spell a chord outright, since then
   * they are the chord rather than a departure from one (INV-NOTES-036).
   */
  voicing?: ChordVoicing;
}

export function normalizePc(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

/** The pitch classes a chord is built from. */
export function chordTones(rootPc: number, quality: ChordQuality): number[] {
  const root = normalizePc(rootPc);
  return CHORD_TONES[quality].map((offset) => normalizePc(root + offset));
}

export function relabel(slot: ChordSlot, key: KeyEstimate): ChordSlot {
  return {
    ...slot,
    label: absoluteLabel(slot.rootPc, slot.quality),
    roman: romanLabel(slot.rootPc, slot.quality, key)
  };
}
