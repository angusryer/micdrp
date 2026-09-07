/**
 * Saying a tap pattern nobody wrote down in advance (INV-NOTES-218).
 *
 * The offered patterns were four-four and three-four, on the reasoning that
 * they cover most singing. They do not cover a phrase sung in six-eight and
 * tapped on one, three and five, and there was no way to say so — the only
 * sentences available were ones somebody else had written.
 *
 * The whole point of supplying the meaning afterwards is that the singer
 * knows what the taps were for (INV-NOTES-209). A closed list takes that
 * back: it says the taps meant one of these six things, and a person whose
 * phrase was none of them is left with marks that stay marks.
 *
 * Its own file because the table next door says what a pattern IS and this
 * says how one is changed; the second is edited far more often than the
 * first, and neither should drag the other into a diff.
 */
import { type TapPattern } from './tapPattern';

/**
 * The longest bar worth offering.
 *
 * Not a claim about music — bars longer than this exist. It is the point
 * past which a row of numbered beats stops being something a thumb can
 * pick from, and a pattern nobody can select is not a pattern offered.
 */
export const MAX_BEATS_PER_BAR = 16;

/** A bar holds at least one beat, and at least one of them was tapped. */
export const MIN_BEATS_PER_BAR = 1;

/** Ascending, no repeats — the order {@link beatPositions} counts in. */
const tidy = (beats: readonly number[]): number[] =>
  Array.from(new Set<number>(beats)).sort((a, b) => a - b);

/**
 * Change how many beats the bar holds.
 *
 * Beats past the end are dropped rather than kept out of range: a pattern
 * the bar cannot hold reads as no tempo at all, so the control would show a
 * pattern set while the taps quietly said nothing (INV-NOTES-219).
 *
 * If that would empty it, beat one stays — which is the beat somebody
 * shortening a bar to four almost always still means.
 */
export function withBeatsPerBar(
  pattern: TapPattern,
  beatsPerBar: number
): TapPattern {
  const held = Math.round(beatsPerBar);
  const next = Math.min(
    Math.max(Number.isFinite(held) ? held : MIN_BEATS_PER_BAR, MIN_BEATS_PER_BAR),
    MAX_BEATS_PER_BAR
  );
  const kept = tidy(pattern.beats).filter((beat) => beat <= next);
  return { beats: kept.length > 0 ? kept : [1], beatsPerBar: next };
}

/**
 * Add or remove one beat of the bar.
 *
 * Removing the last one is refused rather than allowed and then rejected
 * elsewhere. "The taps say nothing" is a real answer with a control of its
 * own; it should not also be reachable by turning off the last beat, where
 * it would look like a pattern that had stopped working.
 */
export function withBeatToggled(
  pattern: TapPattern,
  beat: number
): TapPattern {
  if (!Number.isInteger(beat) || beat < 1 || beat > pattern.beatsPerBar) {
    return pattern;
  }
  const has = pattern.beats.includes(beat);
  if (has && pattern.beats.length === 1) {
    return pattern;
  }
  const beats = has
    ? pattern.beats.filter((b) => b !== beat)
    : [...pattern.beats, beat];
  return { beats: tidy(beats), beatsPerBar: pattern.beatsPerBar };
}
