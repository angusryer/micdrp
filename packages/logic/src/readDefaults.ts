/**
 * What the reading uses when it is told nothing — declared once.
 *
 * Every one of these was written down twice: here in the reader, and again in
 * the client's table of adjustable thresholds. They drifted. "Too brief to
 * have been intended" defaulted to 90ms in the reader and was declared at
 * 70ms beside it, so putting the knobs back did not go back — it went to a
 * reading the take had never had, and the original could not be recovered
 * from inside the app at all (INV-NOTES-187).
 *
 * A test that the two agree says when they have drifted. Taking the value
 * from one place means they cannot (Axiom 2).
 */

export const READ_DEFAULTS = {
  smooth: {
    windowSize: 5,
    minClarity: 0
  },
  segment: {
    minDurationMs: 60,
    maxGapMs: 40,
    vibratoSemitones: 0.6,
    pitchHoldMs: 90,
    articulationDropDb: 12,
    aspirationRiseDb: 8,
    onsetWindowMs: 70,
    onsetFluxDb: -6
  },
  bends: {
    stepSemitones: 1,
    maxJoinGapMs: 40,
    minMoveSemitones: 0.1
  },
  percussion: {
    minLevelDb: -45,
    maxDurationMs: 140,
    maxClarity: 0.5,
    minFlatness: 0.25,
    thumpBelowHz: 700,
    hissAboveHz: 3500
  },
  /** How brief a note has to be before it is taken for a detector slip. */
  minArticulationMs: 90
} as const;
