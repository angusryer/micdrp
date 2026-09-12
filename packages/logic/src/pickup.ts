/**
 * The count-in: beats before the recording, put there by hand.
 *
 * Not a measurement any more (INV-NOTES-250). The old pickup was worked out
 * from wherever the first bar line landed — how far into a bar the singing
 * began — which made it a consequence of the bars rather than a statement
 * about the music, moving whenever they did and saying something nobody had
 * claimed.
 *
 * A count-in is a decision: how many beats you would give somebody before
 * they came in. Only the person who wrote the tune knows it, so they play
 * the take, tap the count they hear, and say how long it runs.
 *
 * It sits before the take's first moment, at negative times. Nothing of the
 * recording moves to make room (INV-NOTES-252): a take is a record of
 * something that happened and its moments are facts, so the drawing widens
 * to the left instead.
 */

/** Fewer taps than this say nothing about a rate (INV-NOTES-198). */
const MIN_TAPS = 3;

/**
 * How much an interval may differ from the run's own pulse and still belong
 * to it, as a fraction.
 *
 * A tenth: a hand counting steadily holds well inside that, and a tap
 * fumbled on the way in or trailing off at the end falls outside it.
 */
const STEADY = 0.1;

export interface Pickup {
  /** How many beats the count runs for. */
  beats: number;
  /** One beat of the count, in ms. */
  beatMs: number;
  /**
   * Where the count ends, in ms. Zero puts it immediately before the take.
   *
   * Draggable, and the only way the count and the singing can overlap
   * (INV-NOTES-253).
   */
  endMs: number;
}

/** Where the count begins, which is the earliest moment the graph shows. */
export function pickupStartMs(pickup: Pickup | null): number {
  if (pickup == null || !(pickup.beatMs > 0) || pickup.beats <= 0) {
    return 0;
  }
  return pickup.endMs - pickup.beats * pickup.beatMs;
}

/** The moments the count's beats fall on, in time order. */
export function pickupBeats(pickup: Pickup | null): number[] {
  if (pickup == null || !(pickup.beatMs > 0) || pickup.beats <= 0) {
    return [];
  }
  const from = pickupStartMs(pickup);
  const out: number[] = [];
  for (let i = 0; i < pickup.beats; i += 1) {
    out.push(from + i * pickup.beatMs);
  }
  return out;
}

/**
 * The pulse of the steadiest run of taps in a pass (INV-NOTES-251).
 *
 * Not the pulse of all of them. A pass begins before the hand has settled
 * and ends after it has stopped meaning it — somebody presses play, waits,
 * finds the beat, counts along, then reaches for stop. Averaging those
 * ragged ends in moves the answer away from the pulse actually played, and
 * they are exactly the taps a person would not defend.
 *
 * So: the longest run of consecutive intervals that all sit within a tenth
 * of that run's own median, and the median of that run is the answer. Its
 * own median rather than the whole pass's, or the ragged ends would decide
 * which middle counts as steady.
 *
 * Null where there is nothing to say. A refusal is a real answer and the
 * caller keeps whatever it had.
 */
export function steadiestPulseMs(taps: readonly number[]): number | null {
  const at = [...taps].sort((a, b) => a - b);
  if (at.length < MIN_TAPS) {
    return null;
  }
  const gaps = at.slice(1).map((ms, i) => ms - at[i]);
  let best: number[] = [];
  for (let from = 0; from < gaps.length; from += 1) {
    for (let to = from + 1; to <= gaps.length; to += 1) {
      const run = gaps.slice(from, to);
      if (!isSteady(run)) {
        break;
      }
      if (run.length > best.length) {
        best = run;
      }
    }
  }
  // Two intervals are the fewest that can agree about anything; one is a
  // single gap, which is the two-taps case again.
  if (best.length < MIN_TAPS - 1) {
    return null;
  }
  const pulse = median(best);
  return pulse > 0 ? pulse : null;
}

/** Whether every interval in a run sits close to the run's own middle. */
function isSteady(run: readonly number[]): boolean {
  const middle = median(run);
  if (!(middle > 0)) {
    return false;
  }
  return run.every((gap) => Math.abs(gap - middle) <= middle * STEADY);
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * The count a pass of taps and a number of beats describe.
 *
 * Null where the taps say nothing: a pass too short or too ragged to have a
 * pulse cannot size a count, and guessing one would put beats in front of
 * the take at a speed nobody played.
 */
export function pickupFrom(
  taps: readonly number[],
  beats: number,
  /**
   * Where the count ends, which is where the coming in happens.
   *
   * The first sung note, not the recording's first moment: a person
   * presses record, waits, and then comes in, so a count ending at zero
   * counts in nothing but silence (INV-NOTES-252). Draggable after
   * (INV-NOTES-268).
   */
  endsAtMs = 0
): Pickup | null {
  const beatMs = steadiestPulseMs(taps);
  if (beatMs == null || !(beats > 0)) {
    return null;
  }
  return { beats: Math.round(beats), beatMs, endMs: endsAtMs };
}

/**
 * The take's own first moment, which nothing of it may be put before
 * (INV-NOTES-253).
 *
 * A count-in is empty by construction — it is counted, not sung — so a note
 * or a beat inside it would claim something was performed in a place where,
 * by definition, nothing was. Moving the count over the take is the one way
 * to say the two overlap, and that is a statement about the count rather
 * than about the recording.
 */
export const TAKE_STARTS_MS = 0;

/** Hold a moment inside the take, wherever the finger went. */
export function insideTake(atMs: number): number {
  return Math.max(TAKE_STARTS_MS, atMs);
}

/** Move the whole count, which is the one way it can reach the take. */
export function movePickup(pickup: Pickup, toEndMs: number): Pickup {
  return { ...pickup, endMs: toEndMs };
}

/** Say how many beats the count runs for, keeping its pulse and its end. */
export function withPickupBeats(pickup: Pickup, beats: number): Pickup | null {
  const n = Math.round(beats);
  return n > 0 ? { ...pickup, beats: n } : null;
}
