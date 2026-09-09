/**
 * How many beats sit in the gap between two taps.
 *
 * The one genuinely uncertain thing about a tapped beat, and the only place
 * anything is inferred at all — where the beats then go is arithmetic
 * (beatAnchors), and where the taps are is not in question (INV-NOTES-198).
 *
 * Two questions, answered from two different places. How a person is
 * tapping — every beat, the backbeat, one to the bar — is a fact about the
 * whole take, and only the melody can settle it, since taps every 1200ms
 * are equally the beat at 50bpm and the backbeat at 100. Whether one
 * particular gap is longer than it should be is a fact about that stretch,
 * and its neighbours settle it far better than the melody can.
 *
 * Keeping them apart is what lets rubato through. A gap measured against a
 * detected period is called two missed taps the moment somebody slows to
 * land a note; measured against the gaps either side of it, the same gap is
 * this stretch's pulse and a real missed tap still stands out.
 */

/** How many beats a gap may hold before it is a silence, not a stretch. */
const MAX_SPAN = 32;

/**
 * How many gaps either side set the pulse a gap is read against.
 *
 * Wide enough that one missed tap cannot drag the median it is measured
 * against up to meet itself, and narrow enough to follow a take that
 * changes speed. Two either side does both: a lone doubled gap sits among
 * four ordinary ones and reads as doubled, while a steady slowing moves the
 * window along with it and reads as one beat throughout.
 */
const WINDOW = 2;

export const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * What one tap-gap is worth in beats: the reading's only say in this.
 *
 * Somebody tapping the backbeat and somebody tapping every beat produce the
 * same evidence about where beats are and differ only in how many lie
 * between, and nothing in the taps alone can tell them apart. The melody's
 * own onsets can, so this is where the reading is asked (INV-NOTES-236).
 *
 * Never less than one. A tap is a beat (INV-NOTES-198), so the reading may
 * say a tap-gap holds more beats than one but never fewer — somebody
 * tapping eighths against a quarter-note reading has tapped eight beats,
 * and dropping half of them to fit the reading would drop what they said.
 *
 * From the whole of the tapping rather than from any one gap, and by a
 * median, which the odd missed tap does not move.
 */
export function beatsPerTap(
  gaps: readonly number[],
  detectedMs: number
): number {
  if (!(detectedMs > 0) || gaps.length === 0) {
    return 1;
  }
  const typical = median(gaps);
  if (!(typical > 0)) {
    return 1;
  }
  return Math.max(1, Math.round(typical / detectedMs));
}

/**
 * How many beats one gap holds, read against the gaps either side of it.
 *
 * The neighbours rather than the reading, because a phrase that stretches
 * moves them with it while a missed tap leaves them where they were — so a
 * stretch reads as one beat and a skip reads as several, which is the
 * distinction the reading alone cannot make.
 *
 * At least one, because two taps are two beats however close together they
 * fell and a tap is never dropped (INV-NOTES-198).
 */
export function spanOf(
  gaps: readonly number[],
  index: number,
  perTap: number
): number {
  const gap = gaps[index];
  if (!(gap > 0)) {
    return perTap;
  }
  const local = median(
    gaps.slice(Math.max(0, index - WINDOW), index + WINDOW + 1)
  );
  const taps = local > 0 ? Math.max(1, Math.round(gap / local)) : 1;
  return Math.min(MAX_SPAN, taps * perTap);
}
