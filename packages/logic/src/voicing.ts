/**
 * voicing — a chord's individual notes, once someone has moved them.
 *
 * A chord stays `(rootPc, quality)`: that pair is what the label, the roman
 * numeral and the diatonic drag are all read from, so it is the spine and it
 * does not bend. What lives here is the layer over it — how far each tone
 * has been nudged from where the plain shape would put it, and which tones
 * are silent.
 *
 * Offsets are held against the chord tone rather than as absolute pitches, so
 * moving the chord carries the voicing along instead of undoing it
 * (INV-NOTES-038).
 */
import { CHORD_TONES, type ChordQuality } from './chordTones';

/** How one chord's notes depart from the plain voicing of its shape. */
export interface ChordVoicing {
  /**
   * Semitones each tone has been moved by, indexed as the quality's tones.
   * A missing entry is zero, so the common case costs nothing to store.
   */
  offsets?: readonly number[];
  /** Which tones are silent, indexed the same way. */
  muted?: readonly boolean[];
}

/** One sounding (or silenced) note of a chord, ready to draw or to play. */
export interface ChordTone {
  /** Position in the quality's tone list — the identity used to edit it. */
  index: number;
  /** Where it actually sits, offset included. */
  midi: number;
  /** Semitones from where the plain shape would have put it. */
  offset: number;
  muted: boolean;
}

/** How far a note may be pushed before it is a different idea, not a voicing. */
export const MAX_TONE_OFFSET = 12;

/**
 * The lowest MIDI note of a chord's root at or above `bottomMidi`.
 *
 * Shared with the voicer so the graph draws a chord where it will sound.
 * Voiced upward from a floor rather than from the root's own octave, so
 * successive chords stay in one register instead of leaping an octave
 * whenever the root crosses B to C.
 */
export function rootMidiAtOrAbove(rootPc: number, bottomMidi: number): number {
  const pc = ((Math.round(rootPc) % 12) + 12) % 12;
  const floorPc = ((Math.round(bottomMidi) % 12) + 12) % 12;
  return bottomMidi + ((pc - floorPc + 12) % 12);
}

/** How many notes a quality has. */
export function toneCount(quality: ChordQuality): number {
  return CHORD_TONES[quality].length;
}

const EMPTY: ChordVoicing = {};

function offsetAt(voicing: ChordVoicing, index: number): number {
  const value = voicing.offsets?.[index];
  return Number.isFinite(value) ? (value as number) : 0;
}

function mutedAt(voicing: ChordVoicing, index: number): boolean {
  return voicing.muted?.[index] === true;
}

/** True once any note has been moved or silenced. */
export function isAltered(voicing: ChordVoicing | undefined): boolean {
  if (!voicing) {
    return false;
  }
  return (
    (voicing.offsets?.some((o) => o !== 0) ?? false) ||
    (voicing.muted?.some((m) => m) ?? false)
  );
}

/** Grow a sparse array to `length`, so an edit past the end still lands. */
function padded<T>(source: readonly T[] | undefined, length: number, fill: T): T[] {
  const out: T[] = [];
  for (let i = 0; i < length; i++) {
    const value = source?.[i];
    out.push(value === undefined ? fill : value);
  }
  return out;
}

/**
 * Move one note by `semitones`, clamped. Returns a new voicing; an index
 * outside the chord is ignored rather than growing a note that cannot sound.
 */
export function moveTone(
  voicing: ChordVoicing | undefined,
  quality: ChordQuality,
  index: number,
  semitones: number
): ChordVoicing {
  const count = toneCount(quality);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    return voicing ?? EMPTY;
  }
  const base = voicing ?? EMPTY;
  const offsets = padded(base.offsets, count, 0);
  const next = offsets[index] + Math.round(semitones);
  offsets[index] = Math.max(-MAX_TONE_OFFSET, Math.min(MAX_TONE_OFFSET, next));
  return { ...base, offsets };
}

/**
 * Silence a note, or bring it back — the same call does both, because an edit
 * that cannot be undone by the gesture that made it is a trap (INV-NOTES-037).
 */
export function toggleMute(
  voicing: ChordVoicing | undefined,
  quality: ChordQuality,
  index: number
): ChordVoicing {
  const count = toneCount(quality);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    return voicing ?? EMPTY;
  }
  const base = voicing ?? EMPTY;
  const muted = padded(base.muted, count, false);
  muted[index] = !muted[index];
  return { ...base, muted };
}

/** Put every note back where the plain shape has it. */
export function clearVoicing(): ChordVoicing {
  return {};
}

/**
 * The notes of a chord in a given register, each carrying what was done to
 * it. Silenced notes are included and flagged: the graph draws them so they
 * can be brought back, and playback filters them out.
 */
export function voicedTones(
  rootMidi: number,
  quality: ChordQuality,
  voicing: ChordVoicing | undefined
): ChordTone[] {
  const base = voicing ?? EMPTY;
  return CHORD_TONES[quality].map((semitone, index) => {
    const offset = offsetAt(base, index);
    return {
      index,
      midi: rootMidi + semitone + offset,
      offset,
      muted: mutedAt(base, index)
    };
  });
}
