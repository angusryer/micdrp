/**
 * The melody as places on a drawn neck.
 *
 * The pitch half of this is `logic/fretboard` — which string, which fret —
 * and the drawing half is `neckLayout`. This is the seam between them, kept
 * pure so both what is placed and what is lit can be asserted without a
 * canvas (INV-NOTES-146, INV-NOTES-149).
 */
import {
  fingerMelody,
  neckOctaveShift,
  SEMITONES_PER_OCTAVE,
  STANDARD_NECK,
  type NeckShape
} from 'logic';

import type { NeckGeometry } from './neckLayout';

export interface PlacedNote {
  startMs: number;
  endMs: number;
  x: number;
  y: number;
  /** For a screen reader and for tests: "5th string, 3rd fret". */
  string: number;
  fret: number;
}

export interface Placed {
  notes: readonly PlacedNote[];
  /** Whole octaves the melody was moved to reach the neck (INV-NOTES-146). */
  octaves: number;
  /** Notes with no place on the neck even after that shift. */
  unplaced: number;
}

export interface PlaceableNote {
  midi: number;
  startMs: number;
  endMs: number;
}

/**
 * Every note of the melody at a point on the board, in the order it is sung.
 *
 * One shift for the whole line, so the intervals drawn on the neck are the
 * intervals that were sung; anything still off the neck is left out rather
 * than pulled onto it (INV-NOTES-146).
 */
export function placeMelody(
  melody: readonly PlaceableNote[],
  geometry: NeckGeometry,
  neck: NeckShape = STANDARD_NECK
): Placed {
  const octaves = neckOctaveShift(
    melody.map((note) => note.midi),
    neck
  );
  const by = octaves * SEMITONES_PER_OCTAVE;
  const places = fingerMelody(
    melody.map((note) => note.midi + by),
    neck
  );
  const notes: PlacedNote[] = [];
  let unplaced = 0;
  places.forEach((place, index) => {
    if (place == null) {
      unplaced += 1;
      return;
    }
    notes.push({
      startMs: melody[index].startMs,
      endMs: melody[index].endMs,
      x: geometry.centreOf(place.fret),
      y: geometry.stringYs[place.string],
      string: place.string,
      fret: place.fret
    });
  });
  return { notes, octaves, unplaced };
}

/**
 * Every point on the board the line visits, once each.
 *
 * Drawn faintly under the lit one, so the shape of the phrase under the hand
 * is there to read while nothing is playing. A neck that lights only the note
 * sounding is blank most of the time somebody is looking at it.
 */
export function visitedPlaces(
  notes: readonly PlacedNote[]
): { key: string; x: number; y: number }[] {
  const seen = new Map<string, { x: number; y: number }>();
  for (const note of notes) {
    seen.set(`${note.string}:${note.fret}`, { x: note.x, y: note.y });
  }
  return [...seen.entries()].map(([key, at]) => ({ key, ...at }));
}

/**
 * Which place is lit at this moment, or -1 between notes.
 *
 * A worklet: it runs on the UI thread every frame off the same shared value
 * the playhead is drawn from, so the neck can never be a frame behind the
 * line it is fingering (INV-NOTES-149). Binary search rather than a scan —
 * a long take is hundreds of notes and this runs sixty times a second.
 */
export function activePlace(
  notes: readonly PlacedNote[],
  positionMs: number
): number {
  'worklet';
  let low = 0;
  let high = notes.length - 1;
  let started = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (notes[mid].startMs > positionMs) {
      high = mid - 1;
    } else {
      started = mid;
      low = mid + 1;
    }
  }
  if (started < 0) {
    return -1;
  }
  return positionMs <= notes[started].endMs ? started : -1;
}
