/**
 * Which knob to reach for first (INV-NOTES-172).
 *
 * Ordered by how much moving one changes a WHISTLED melody. Whistling has a
 * soft onset — no consonant, no aspirated attack — and it scoops into pitch,
 * landing near the note rather than on it. So the numbers deciding how much
 * pitch movement is still one note dominate: tolerate too little of a scoop
 * and one note becomes three, too much and two become one. The numbers
 * listening for a re-attack on the breath barely fire at all, because a
 * whistle never makes one.
 *
 * Its own file because this is a judgement about a person's singing rather
 * than a fact about the reading, and it will change as the tuning does. The
 * table next door says what exists; this says what to try first.
 */
import { DECLARED_KNOBS, type ReadingKnob } from './readingKnobs';

const BY_IMPACT: readonly string[] = [
  // The scoop itself: how long a new pitch must hold, and how much movement
  // is still one note. Everything a whistle gets wrong is here.
  'segment.pitchHoldMs',
  'segment.vibratoSemitones',
  // Then whether two readings of one scooped note get joined back together.
  'bends.minMoveSemitones',
  'bends.maxJoinGapMs',
  // Then what is small enough to throw away, which is what a scoop leaves.
  'segment.minDurationMs',
  'top.minArticulationMs',
  // Then the trace the whole thing is read from.
  'smooth.windowSize',
  'segment.maxGapMs',
  // A whistle is legato and level: these rarely decide anything.
  'segment.articulationDropDb',
  'smooth.minClarity',
  // A whistle has no aspirated re-attack at all.
  'segment.aspirationRiseDb',
  'segment.onsetWindowMs',
  // And it is not a drum.
  'percussion.minLevelDb',
  'percussion.maxClarity',
  'percussion.minFlatness',
  'percussion.maxDurationMs'
];

/** Where a knob sits in that order; unlisted ones fall to the end. */
export function knobRank(knob: ReadingKnob): number {
  const at = BY_IMPACT.indexOf(`${knob.group}.${knob.key}`);
  return at === -1 ? BY_IMPACT.length : at;
}

/**
 * Every knob, most likely to change a whistled reading first.
 *
 * Sorted here rather than written in order, so the declarations stay grouped
 * by what they belong to — a knob is easiest to find beside its neighbours
 * and easiest to use beside whatever else matters as much.
 */
export const READING_KNOBS: readonly ReadingKnob[] = [...DECLARED_KNOBS].sort(
  (a, b) => knobRank(a) - knobRank(b)
);
