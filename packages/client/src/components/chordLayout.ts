/**
 * chordLayout — where a chord's individual notes sit on the melody's own axes.
 *
 * Drawn against the same pitch ruler as the sung line, not a band with its own
 * scale: the graph's whole claim is that vertical distance is pitch distance,
 * and two scales on one screen would make the same interval measure two
 * different heights.
 *
 * Which register the chords occupy is the caller's choice, because it is
 * really a question about what you are listening on. A phone speaker has
 * almost nothing below a few hundred hertz, so a backdrop voiced where a
 * piano would put it is inaudible on one; lifted towards the melody it can be
 * heard. On headphones the low voicing is the better sound. Same control,
 * both consequences — the chords move on the graph exactly as far as they
 * move in the ear.
 */
import {
  rootMidiAtOrAbove,
  voicedTones,
  type ChordQuality,
  type ChordVoicing
} from 'logic';

import type { PitchAxis, TimeAxis } from './melodyLayout';
import { xForMs } from './melodyScale';
import { yForMidi } from './melodyPitch';

/** A chord placed in time, as the graph needs it. */
export interface PlacedChord {
  startMs: number;
  endMs: number;
  rootPc: number;
  quality: ChordQuality;
  voicing?: ChordVoicing;
}

/**
 * Where the chords sit when the phone's own speaker has to carry them.
 *
 * A built-in speaker rolls off steeply and has effectively nothing left an
 * octave below middle C, so a backdrop down there is felt as absence rather
 * than heard as harmony. This is a starting point to be moved by ear, not a
 * measurement: iOS exposes no speaker response curve to compute it from.
 */
export const SPEAKER_FLOOR_MIDI = 55;

/** Where they sit on headphones, which reproduce the low register properly. */
export const HEADPHONE_FLOOR_MIDI = 48;

/** One drawn note of a chord, and the identity needed to edit it. */
export interface ChordToneRect {
  /** Index of the slot in the progression. */
  slot: number;
  /** Index of the note within the chord — what an edit names. */
  tone: number;
  x: number;
  y: number;
  width: number;
  height: number;
  midi: number;
  muted: boolean;
  /** True once this note has been moved off its chord tone. */
  moved: boolean;
}

/** Every pitch the chords will occupy, so the axis can make room for them. */
export function chordPitches(
  slots: readonly PlacedChord[],
  floorMidi: number
): number[] {
  const pitches: number[] = [];
  for (const slot of slots) {
    const rootMidi = rootMidiAtOrAbove(slot.rootPc, floorMidi);
    for (const tone of voicedTones(rootMidi, slot.quality, slot.voicing)) {
      pitches.push(tone.midi);
    }
  }
  return pitches;
}

/**
 * Lay every chord's notes out across the slots they belong to.
 *
 * A note is drawn whether or not it is silenced — a silenced one has to stay
 * visible to be brought back (INV-NOTES-037) — and carries its flags so the
 * painter can show which is which.
 */
export function layoutChordTones(
  slots: readonly PlacedChord[],
  timeAxis: TimeAxis,
  pitchAxis: PitchAxis,
  floorMidi: number
): ChordToneRect[] {
  const { pxPerMs } = timeAxis;
  const height = Math.max(3, pitchAxis.lane * 0.7);
  const rects: ChordToneRect[] = [];

  slots.forEach((slot, slotIndex) => {
    const x = xForMs(timeAxis, slot.startMs);
    // A hair short of the slot end, so neighbouring chords read as separate
    // blocks rather than one unbroken run.
    const width = Math.max(2, (slot.endMs - slot.startMs) * pxPerMs - 2);
    const rootMidi = rootMidiAtOrAbove(slot.rootPc, floorMidi);

    for (const tone of voicedTones(rootMidi, slot.quality, slot.voicing)) {
      const cy = yForMidi(pitchAxis, tone.midi);
      rects.push({
        slot: slotIndex,
        tone: tone.index,
        x,
        y: cy - height / 2,
        width,
        height,
        midi: tone.midi,
        muted: tone.muted,
        moved: tone.offset !== 0
      });
    }
  });

  return rects;
}

/**
 * Which drawn note a touch is on, or null. Nearest by centre within a lane's
 * reach, so a thumb that lands between two notes picks the closer rather than
 * nothing at all.
 */
export function chordToneAt(
  rects: readonly ChordToneRect[],
  x: number,
  y: number,
  reach: number
): ChordToneRect | null {
  let best: ChordToneRect | null = null;
  let bestDistance = Infinity;
  for (const rect of rects) {
    if (x < rect.x || x > rect.x + rect.width) {
      continue;
    }
    const distance = Math.abs(y - (rect.y + rect.height / 2));
    if (distance < bestDistance && distance <= reach) {
      bestDistance = distance;
      best = rect;
    }
  }
  return best;
}
