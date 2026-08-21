/**
 * Where a take actually sits, as distinct from where concert pitch is.
 *
 * Someone humming an idea has nothing to tune to. What matters is whether the
 * notes agree with one another, not whether they agree with a tuning fork — a
 * phrase sung beautifully thirty cents sharp was reported as thirty cents
 * wrong on every note, which is true and useless (INV-PITCH-013).
 *
 * So the centre is measured from the take itself and everything is judged
 * against that. The offset is reported rather than quietly applied: adjusting
 * a reading without saying so is how a tool stops being trustworthy
 * (INV-PITCH-014).
 *
 * Pure, dependency-free.
 */
import type { NoteEvent } from './segmentation';

/** A semitone, in cents — the circle these deviations live on. */
const SEMITONE_CENTS = 100;

export interface TuningCentre {
  /** Cents the take sits above concert pitch; negative is flat. */
  offsetCents: number;
  /**
   * How tightly the notes agree on that centre, 0..1.
   *
   * The resultant length from the circular mean. Near 1 the take has a clear
   * pitch centre; near 0 the notes disagree so thoroughly that there is no
   * centre to find, and concert pitch is as good an answer as any.
   */
  confidence: number;
}

/**
 * The pitch centre a take was actually sung at.
 *
 * Circular statistics, as the pulse is fitted. Deviations wrap at half a
 * semitone, so a note at +48 and one at -48 are nearly the same note; an
 * ordinary average of the two lands at zero, which is precisely wrong.
 *
 * Notes are weighted by how long they were held. A passing sixteenth says
 * much less about where someone is centred than a note they sat on.
 */
export function tuningCentre(notes: readonly NoteEvent[]): TuningCentre {
  let x = 0;
  let y = 0;
  let weight = 0;

  for (const note of notes) {
    const w = Math.max(note.durationMs, 1);
    // One full turn of the circle is one semitone.
    const angle = (2 * Math.PI * note.cents) / SEMITONE_CENTS;
    x += w * Math.cos(angle);
    y += w * Math.sin(angle);
    weight += w;
  }

  if (weight === 0) {
    return { offsetCents: 0, confidence: 0 };
  }

  const meanX = x / weight;
  const meanY = y / weight;
  const resultant = Math.sqrt(meanX * meanX + meanY * meanY);
  if (resultant < 1e-9) {
    // The notes cancel out entirely: there is no centre to speak of.
    return { offsetCents: 0, confidence: 0 };
  }

  const offsetCents = (Math.atan2(meanY, meanX) * SEMITONE_CENTS) / (2 * Math.PI);
  return { offsetCents, confidence: resultant };
}

/**
 * A deviation restated against the take's own centre.
 *
 * Wrapped back into half a semitone either way, because a note is always
 * nearer to some semitone than half of one.
 */
export function relativeCents(cents: number, offsetCents: number): number {
  let relative = cents - offsetCents;
  while (relative > SEMITONE_CENTS / 2) {
    relative -= SEMITONE_CENTS;
  }
  while (relative < -SEMITONE_CENTS / 2) {
    relative += SEMITONE_CENTS;
  }
  return relative;
}
