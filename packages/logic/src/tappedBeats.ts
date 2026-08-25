/**
 * The beat, tapped in by the person who sang it.
 *
 * Everything else in the app infers where the beat is. The fitter deduces it
 * from onsets, which is genuinely hard; a sung count states it but only for
 * the bars somebody counted (INV-PITCH-022). A tap says it outright, by the
 * one party who knows, and there is nothing to detect in a tap so there is
 * nothing to get wrong (INV-NOTES-130).
 *
 * What a tap is NOT is a complete account. Nobody taps every beat of every
 * take, so the taps are evidence rather than a transcript, and the grid the
 * rest of the beats come from is fitted to them in `beatGrid` — this module
 * only holds what a person actually did (INV-NOTES-131).
 *
 * A tapped beat can be moved, and remembers where the finger actually landed.
 * Tapping along is played rather than typed, so a beat can be a little late
 * without being wrong about which beat it is — and correcting one must not
 * destroy the evidence of what was performed (INV-NOTES-022).
 */

export interface TappedBeat {
  /** Where it sits now, after any correction. */
  atMs: number;
  /** Where the finger actually landed. Kept, so a move is reversible. */
  tappedAtMs: number;
  /** Marked as the start of a bar. */
  isDownbeat: boolean;
}

/** Two taps closer than this are one finger bouncing, not two beats. */
const DEBOUNCE_MS = 90;

/** A tap becomes a beat exactly where it landed. */
export function beatFromTap(atMs: number): TappedBeat {
  const at = Math.max(0, atMs);
  return { atMs: at, tappedAtMs: at, isDownbeat: false };
}

/**
 * Add a tap to what has been tapped, ignoring a bouncing finger.
 *
 * In time order, because a tap made after scrubbing backwards belongs where
 * it landed rather than at the end of the list.
 */
export function addTap(
  beats: readonly TappedBeat[],
  atMs: number
): TappedBeat[] {
  const beat = beatFromTap(atMs);
  if (beats.some((b) => Math.abs(b.atMs - beat.atMs) < DEBOUNCE_MS)) {
    return [...beats];
  }
  return [...beats, beat].sort((a, b) => a.atMs - b.atMs);
}

/** Move one beat, keeping the record of where it was actually tapped. */
export function moveBeat(
  beats: readonly TappedBeat[],
  index: number,
  toMs: number
): TappedBeat[] {
  return beats
    .map((beat, i) =>
      i === index ? { ...beat, atMs: Math.max(0, toMs) } : beat
    )
    .sort((a, b) => a.atMs - b.atMs);
}

/** Put one beat back where the finger landed. */
export function resetBeat(
  beats: readonly TappedBeat[],
  index: number
): TappedBeat[] {
  return beats
    .map((beat, i) => (i === index ? { ...beat, atMs: beat.tappedAtMs } : beat))
    .sort((a, b) => a.atMs - b.atMs);
}

/** Throw one beat away. */
export function removeBeat(
  beats: readonly TappedBeat[],
  index: number
): TappedBeat[] {
  return beats.filter((_, i) => i !== index);
}

/**
 * The beats a fresh pass leaves behind.
 *
 * Tapping again is a correction, not an addition: somebody who taps a second
 * time through the take is saying "not like that, like this", and merging the
 * two passes would give them both readings at once — a grid twice as dense as
 * either, fitted to a pulse nobody played (INV-NOTES-131).
 *
 * Bar marks survive where a new tap landed on one, because which beats begin
 * bars is a separate statement from where the beats are, and re-tapping the
 * pulse does not retract it.
 */
export function replaceTaps(
  previous: readonly TappedBeat[],
  fresh: readonly TappedBeat[]
): TappedBeat[] {
  const marked = previous.filter((beat) => beat.isDownbeat);
  return fresh.map((beat) => ({
    ...beat,
    isDownbeat:
      beat.isDownbeat ||
      marked.some((old) => Math.abs(old.atMs - beat.atMs) < DEBOUNCE_MS)
  }));
}

/** Mark or unmark a beat as the start of a bar. */
export function markDownbeat(
  beats: readonly TappedBeat[],
  index: number,
  isDownbeat: boolean
): TappedBeat[] {
  return beats.map((beat, i) =>
    i === index ? { ...beat, isDownbeat } : beat
  );
}
