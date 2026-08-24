/**
 * Which reading of the audio a stored take was given.
 *
 * A take has exactly two things that cannot be recomputed: the recording, and
 * what a person did to it. The melody, the hits, the chords, the grid, the key
 * and the tempo are all readings of the first, and every one of them can be
 * thrown away and produced again (INV-NOTES-116).
 *
 * That makes staleness a fact rather than a guess. A take carries the version
 * that read it, so the app can say "this was read by an older engine" and mean
 * it, instead of offering a re-read on every note in the library and hoping.
 *
 * Bump this whenever a change would make the same audio read differently.
 * Adding a field nothing reads yet does not count; changing what a note is,
 * what counts as an onset, or what the engine reports does.
 *
 * 1. The reading before this was recorded — every take captured before the
 *    version existed reads as this, since that is what they got.
 * 2. Loudness per note; the tongued and breathed articulation rules; the
 *    count-in read from the accents.
 * 3. The autocorrelation as a transform, the spectrum that falls out of it,
 *    onsets read from spectral flux, and half the hop.
 */
export const ANALYSIS_VERSION = 3;

/** Whether a take would read differently if it were read again now. */
export function isStale(version: number | null | undefined): boolean {
  return (version ?? 1) < ANALYSIS_VERSION;
}
