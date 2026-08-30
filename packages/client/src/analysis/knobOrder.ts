/**
 * Which knob to reach for first (INV-NOTES-172).
 *
 * Ordered by how much moving one changes a WHISTLED melody, for a whistler
 * who tongues — who taps the tongue against the roof of the mouth to start a
 * note, as a flute player does.
 *
 * That gives two failure modes, not one.
 *
 * Into a DIFFERENT pitch, the whistle scoops: it slides up to the note and
 * lands near it rather than on it. There is pitch evidence, and the numbers
 * deciding how much movement is still one note settle it — tolerate too
 * little of a scoop and one note becomes three, too much and two become one.
 *
 * On a REPEATED pitch there is no pitch evidence at all. The trace runs
 * straight through the tongue tap, and the only sign anything happened is the
 * brief dip in level while the airstream is interrupted. So the level knobs
 * are not a footnote for this player; they are the whole of how a repeated
 * note is found.
 *
 * What stays at the bottom is the rise that follows a note pushed again on
 * the breath. A tongue stops the air and releases it; it does not swell into
 * the note, so that pair almost never fires.
 *
 * Its own file because this is a judgement about a person's singing rather
 * than a fact about the reading, and it will change as the tuning does. The
 * table next door says what exists; this says what to try first.
 */
import { DECLARED_KNOBS, type ReadingKnob } from './readingKnobs';

const BY_IMPACT: readonly string[] = [
  // The scoop into a new pitch: how long that pitch must hold before it is a
  // note of its own.
  'segment.pitchHoldMs',
  // A tongued repeat at the same pitch, where the level dip is the ONLY
  // evidence there are two notes. These two decide whether it is found at
  // all, and whether the interruption is read as the note ending.
  'segment.articulationDropDb',
  'segment.maxGapMs',
  // Back to the scoop: how much wander is still one note.
  'segment.vibratoSemitones',
  // Then whether two readings of one scooped note get joined back together.
  'bends.minMoveSemitones',
  'bends.maxJoinGapMs',
  // Then what is small enough to throw away, which is what a scoop leaves.
  'segment.minDurationMs',
  'top.minArticulationMs',
  // A tongue tap is brief and barely pitched, so it can be mistaken for a
  // mouth drum. If phantom drums appear where the tonguing is, these are
  // where to look.
  'percussion.maxClarity',
  'percussion.minLevelDb',
  'percussion.maxDurationMs',
  'percussion.minFlatness',
  // The trace everything is read from, and the floor under it.
  'smooth.windowSize',
  'smooth.minClarity',
  // A tongue stops the air and releases it rather than swelling into the
  // note, so the rise that follows a breath push almost never fires.
  'segment.aspirationRiseDb',
  'segment.onsetWindowMs'
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
