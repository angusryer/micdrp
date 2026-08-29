/**
 * Where a sung line falls under a hand on a guitar neck.
 *
 * A pitch is available in several places on a fretboard, and which one you
 * mean is a question about the hand, not about the note. So this answers it
 * the way a player does: take the place nearest the one you are already in,
 * counting a fret of travel as twice a string of travel, because sideways
 * along the neck is the expensive direction (INV-NOTES-147).
 *
 * The whole melody moves onto the neck together or not at all
 * (INV-NOTES-146). Shifting note by note would let a phrase climbing past the
 * top of the neck reappear at the bottom, drawn as a fall — the opposite of
 * the line rather than an approximation of it.
 *
 * Pure, dependency-free.
 */
import { SEMITONES_PER_OCTAVE } from './transpose';

/**
 * Standard tuning as sounding MIDI, lowest string first: E2 A2 D3 G3 B3 E4.
 *
 * Sounding, not written. Guitar music is written an octave above where it
 * sounds, and a melody read off a voice has no such convention — comparing
 * the two in different registers would place every note a string too high.
 */
export const STANDARD_TUNING: readonly number[] = [40, 45, 50, 55, 59, 64];

/** How far up the neck is drawn. The twelfth is where the octave repeats. */
export const NECK_FRETS = 12;

/** The most octaves the melody will be moved to get it onto the neck. */
const SHIFT_LIMIT = 4;

/** A fret of travel costs this many strings of travel (INV-NOTES-147). */
const FRET_COST = 2;
const STRING_COST = 1;

export interface FretPlace {
  /** 0 is the lowest-sounding string, `tuning.length - 1` the highest. */
  string: number;
  /** 0 is the open string. */
  fret: number;
}

export interface NeckShape {
  tuning: readonly number[];
  frets: number;
}

export const STANDARD_NECK: NeckShape = {
  tuning: STANDARD_TUNING,
  frets: NECK_FRETS
};

/** Every place this pitch can be taken, lowest string first. */
export function placesFor(midi: number, neck: NeckShape): FretPlace[] {
  const places: FretPlace[] = [];
  for (let string = 0; string < neck.tuning.length; string += 1) {
    const fret = Math.round(midi) - neck.tuning[string];
    if (fret >= 0 && fret <= neck.frets) {
      places.push({ string, fret });
    }
  }
  return places;
}

/** What it costs the hand to go from one place to another. */
function travel(from: FretPlace, to: FretPlace): number {
  return (
    FRET_COST * Math.abs(to.fret - from.fret) +
    STRING_COST * Math.abs(to.string - from.string)
  );
}

/**
 * The one whole-octave shift that puts the most of this melody on the neck.
 *
 * Ties go to the smaller move, and then to the lower one, so the answer never
 * depends on the order the shifts happened to be tried in. A melody that
 * already fits gets zero, which is the case worth being exactly right about.
 */
export function neckOctaveShift(
  midis: readonly number[],
  neck: NeckShape = STANDARD_NECK
): number {
  if (midis.length === 0) {
    return 0;
  }
  let best = 0;
  let bestOnNeck = -1;
  for (let shift = -SHIFT_LIMIT; shift <= SHIFT_LIMIT; shift += 1) {
    const by = shift * SEMITONES_PER_OCTAVE;
    let onNeck = 0;
    for (const midi of midis) {
      if (placesFor(midi + by, neck).length > 0) {
        onNeck += 1;
      }
    }
    const better =
      onNeck > bestOnNeck ||
      (onNeck === bestOnNeck && Math.abs(shift) < Math.abs(best));
    if (better) {
      best = shift;
      bestOnNeck = onNeck;
    }
  }
  return best;
}

/**
 * Each note of the melody in its place, or null where it has none.
 *
 * A note with no place does not move the hand: the note after it is measured
 * from the last note that was actually taken, so a single outlier does not
 * throw the position the rest of the phrase is played in.
 */
export function fingerMelody(
  midis: readonly number[],
  neck: NeckShape = STANDARD_NECK
): (FretPlace | null)[] {
  let last: FretPlace | null = null;
  return midis.map((midi) => {
    const places = placesFor(midi, neck);
    if (places.length === 0) {
      return null;
    }
    // The first note opens the hand at the lowest fret that can take it;
    // after that the nearest place wins, ties to the lower fret.
    const chosen = places.reduce((best, place) => {
      const cost = last == null ? place.fret : travel(last, place);
      const bestCost = last == null ? best.fret : travel(last, best);
      return cost < bestCost || (cost === bestCost && place.fret < best.fret)
        ? place
        : best;
    });
    last = chosen;
    return chosen;
  });
}
