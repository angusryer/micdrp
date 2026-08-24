/**
 * Reading the tempo off a count SUNG INTO the take.
 *
 * Not to be confused with `countIn` in bassContext, which is the count the app
 * PLAYS before an overdub so a second voice knows when to come in. One is
 * something the app produces; this is something it reads. They were briefly
 * both called CountIn, which is the kind of collision that only ever ends in
 * someone changing the wrong one (INV-PITCH-021).
 *
 * Everything else in the tempo estimator infers a beat from music, which is
 * hard: a melody's onsets fall on some beats and not others, some of them are
 * syncopated, and the strongest periodicity is often twice or half the one a
 * person would tap. A count is different in kind — it is somebody stating the
 * tempo out loud before playing, deliberately even, deliberately accented. It
 * is the one place in a take where the answer is being told to us rather than
 * deduced (INV-PITCH-022).
 *
 * So it is read separately and trusted over the inference when it is there.
 *
 * What makes it findable is loudness (INV-PITCH-020): the stressed beat of a
 * count is louder than the ones around it, and that pattern is what says how
 * many beats are in a bar. Without a level per note there is nothing here to
 * read, which is why this could not be written until there was one.
 */
import type { NoteEvent } from './segmentation';

/** How far an interval may sit from the run's median and still belong to it. */
const EVENNESS = 0.18;

/** Fewer intervals than this is not a count, it is a coincidence. */
const MIN_INTERVALS = 3;

/** Past this many notes we are into the music, not the count. */
const MAX_COUNTED = 8;

/** How much louder a beat must be than its neighbours to read as accented. */
const ACCENT_DB = 2.5;

export interface SungCount {
  /** One beat, in ms, as counted. */
  beatMs: number;
  /** Where the first counted beat begins. */
  startMs: number;
  /** Where the count stops and the music may begin. */
  endMs: number;
  /** How many beats were counted. */
  beats: number;
  /** Beats to a bar, from where the accents fell. */
  beatsPerBar: number;
  /** 0..1 — how evenly it was counted, and over how many beats. */
  confidence: number;
}

/**
 * The take split into what was counted and what was played.
 *
 * The counted beats are a performance — they were sung, they are in the
 * recording, and they belong on the graph. What they are not is music: "one
 * two three four" states a tempo and implies no harmony, so reading chords
 * from it produces a chord over the counting and drags the key estimate
 * towards whatever pitch the counting happened to sit on (INV-NOTES-113).
 *
 * Both halves are returned rather than the count being dropped, because
 * hiding part of a take would be the app deciding something was not sung.
 */
export function splitOffCount(notes: readonly NoteEvent[]): {
  counted: NoteEvent[];
  played: NoteEvent[];
} {
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs);
  const count = readSungCount(sorted);
  if (count == null) {
    return { counted: [], played: sorted };
  }
  // By position rather than by time: the count is the opening run, and a note
  // of the music beginning exactly as the count ends belongs to the music.
  return {
    counted: sorted.slice(0, count.beats),
    played: sorted.slice(count.beats)
  };
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * The longest run of evenly spaced onsets at the start of the take.
 *
 * From the start because that is what a count is. A stretch of even onsets in
 * the middle of a take is a repeated figure, and reading the tempo off it
 * would let one bar of the music overrule everything around it.
 */
function evenRun(onsets: readonly number[]): number[] {
  if (onsets.length < MIN_INTERVALS + 1) {
    return [];
  }
  const gaps: number[] = [];
  for (let i = 1; i < Math.min(onsets.length, MAX_COUNTED); i++) {
    gaps.push(onsets[i] - onsets[i - 1]);
  }
  // Grow the run while each new gap still agrees with the ones before it,
  // rather than testing every gap against the whole take's median — a count
  // followed by a long first note would otherwise fail on that one gap.
  let end = 1;
  while (end < gaps.length) {
    const so_far = median(gaps.slice(0, end + 1));
    const off = gaps
      .slice(0, end + 1)
      .some((g) => Math.abs(g - so_far) > so_far * EVENNESS);
    if (off) {
      break;
    }
    end += 1;
  }
  return gaps.slice(0, end);
}

/**
 * Which beat of the count was stressed, from how loud each one was.
 *
 * This is what makes a count a count. Evenly spaced onsets on their own are
 * not evidence of one — an ordinary melody in steady quarter notes looks
 * exactly the same, and reading it as a stated tempo would let this override
 * the general fitter on takes that never had a count in them. The accents are
 * the part nothing else produces by accident.
 *
 * Null when the count was flat, or when nothing measured the loudness at all,
 * and in both cases there is no count to report.
 */
function accentPeriod(counted: readonly NoteEvent[]): number | null {
  const levels = counted.map((n) => n.loudnessDb);
  if (levels.some((l) => l == null)) {
    return null;
  }
  const known = levels as number[];
  let best: { period: number; margin: number } | null = null;
  for (const period of [2, 3, 4]) {
    if (counted.length < period + 1) {
      continue;
    }
    const on: number[] = [];
    const off: number[] = [];
    known.forEach((level, i) => (i % period === 0 ? on : off).push(level));
    if (on.length === 0 || off.length === 0) {
      continue;
    }
    const margin =
      on.reduce((a, b) => a + b, 0) / on.length -
      off.reduce((a, b) => a + b, 0) / off.length;
    if (margin >= ACCENT_DB && (!best || margin > best.margin)) {
      best = { period, margin };
    }
  }
  return best?.period ?? null;
}

/**
 * The count at the head of a take, or null when there is not one.
 *
 * Null rather than a low-confidence reading: a take that opens straight into
 * the tune has no count, and reporting one weakly is worse than reporting
 * none, because the caller's whole reason to ask is to override an inference
 * it already has.
 *
 * Null too whenever the loudness is unknown — every take captured before
 * levels were measured, and any recorded by a binary older than the bundle
 * reading it. Those takes keep the tempo the general fitter gives them, which
 * is what they have always had (INV-PITCH-020).
 */
export function readSungCount(notes: readonly NoteEvent[]): SungCount | null {
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs);
  const gaps = evenRun(sorted.map((n) => n.startMs));
  if (gaps.length < MIN_INTERVALS) {
    return null;
  }
  const counted = sorted.slice(0, gaps.length + 1);
  const beatMs = median(gaps);
  if (!(beatMs > 0)) {
    return null;
  }
  // No accents, no count. Even spacing alone describes a metronomic melody
  // just as well, and this reading exists to override the general fitter —
  // so it has to be sure, not merely plausible.
  const beatsPerBar = accentPeriod(counted);
  if (beatsPerBar == null) {
    return null;
  }
  // How tightly it was counted, as the average miss against the beat, and how
  // much of a count there was to read. Both matter: four dead-even beats is a
  // count, and twelve ragged ones is a riff.
  const drift =
    gaps.reduce((sum, g) => sum + Math.abs(g - beatMs), 0) /
    (gaps.length * beatMs);
  const evenness = Math.max(0, 1 - drift / EVENNESS);
  const length = Math.min(1, gaps.length / 4);

  return {
    beatMs,
    startMs: counted[0].startMs,
    endMs: counted[counted.length - 1].endMs,
    beats: counted.length,
    beatsPerBar,
    confidence: evenness * length
  };
}
