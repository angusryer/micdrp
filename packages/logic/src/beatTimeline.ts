/**
 * The beat of a take, as the person who sang it stated it.
 *
 * A tap is one beat, and the taps in order are the beat (INV-NOTES-198).
 * Nothing here fits a period or decides that a gap spanned several beats:
 * somebody tapping while they sing is stating the pulse their singing
 * lives around, and that pulse moves — slowing to land a note is playing,
 * not error, and a fitted tempo discards exactly that.
 *
 * This is not the grid INV-NOTES-131 removed. That one inferred: it
 * guessed spans, fitted a uniform tempo, and let the result silently
 * re-cut somebody's harmony. This one counts.
 *
 * Musical position comes from interpolating between beats rather than
 * dividing a constant tempo, which is the whole difference: between two
 * taps 1.4 seconds apart the beat is 1.4 seconds long, and between the
 * next two it is whatever it is.
 */
import type { MusicalGrid } from './quantize';
import type { TappedBeat } from './tappedBeats';

export interface BeatTimeline {
  /** Beat instants in ms, ascending. Index i is beat i. */
  beats: number[];
  /** Indices into `beats` of the beats that begin a bar, ascending. */
  barStarts: number[];
  /**
   * Gaps that look like a missed tap: index i is between beat i and i+1.
   *
   * Reported and nothing else (INV-NOTES-200). One tap is one beat, so a
   * missed tap makes a bar genuinely short and there is no way to tell
   * that from a bar that was short.
   */
  suspectGaps: number[];
  /** True when this came from taps rather than from a fitted grid. */
  isTapped: boolean;
}

/** One bar, counted rather than fitted (INV-NOTES-199). */
export interface CountedBar {
  /** 1-based, counting only whole bars. A pickup is bar 0. */
  index: number;
  /** Index into `beats` of the beat this bar starts on. */
  startBeat: number;
  /** How many beats it holds. */
  beatCount: number;
  /** True for beats before the first downbeat, or after the last. */
  isPartial: boolean;
}

/** The pulse a set of taps was made at, as a spread (INV-NOTES-201). */
export interface TappedTempo {
  medianBpm: number;
  slowestBpm: number;
  fastestBpm: number;
}

/** Fewer beats than this and there are no intervals worth describing. */
const MIN_FOR_TEMPO = 3;

/** A gap at least this many times the local median looks like a missed tap. */
const SUSPECT_RATIO = 1.7;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/** The intervals between consecutive beats, in ms. */
export function beatIntervals(timeline: BeatTimeline): number[] {
  return timeline.beats.slice(1).map((at, i) => at - timeline.beats[i]);
}

/**
 * Which gaps look like a missed tap.
 *
 * Compared against the median of every gap rather than only the immediate
 * neighbours: a passage that slows steadily has no single odd gap in it,
 * and comparing each to its neighbour would find one everywhere the tempo
 * turned a corner.
 */
function suspectGapsOf(intervals: readonly number[]): number[] {
  if (intervals.length < MIN_FOR_TEMPO) {
    return [];
  }
  const typical = median(intervals);
  const out: number[] = [];
  for (let i = 0; i < intervals.length; i += 1) {
    if (intervals[i] >= typical * SUSPECT_RATIO) {
      out.push(i);
    }
  }
  return out;
}

/**
 * The timeline a person's taps state.
 *
 * Null where there is not enough to be a timeline: one beat is a moment,
 * and two are an interval that says nothing about whether it would have
 * happened again.
 */
export function timelineFromTaps(taps: readonly TappedBeat[]): BeatTimeline | null {
  const sorted = [...taps].sort((a, b) => a.atMs - b.atMs);
  if (sorted.length < MIN_FOR_TEMPO) {
    return null;
  }
  const beats = sorted.map((tap) => tap.atMs);
  return {
    beats,
    barStarts: sorted
      .map((tap, i) => (tap.isDownbeat ? i : -1))
      .filter((i) => i >= 0),
    suspectGaps: suspectGapsOf(beats.slice(1).map((at, i) => at - beats[i])),
    isTapped: true
  };
}

/**
 * A timeline from a fitted grid, for a take nobody tapped.
 *
 * The same shape from the other source, so everything downstream reads
 * one thing. A metronome is a timeline whose beats happen to be evenly
 * spaced; that is the only difference between them.
 */
export function timelineFromGrid(grid: MusicalGrid, throughMs: number): BeatTimeline {
  if (grid.bpm <= 0) {
    return { beats: [], barStarts: [], suspectGaps: [], isTapped: false };
  }
  const beatMs = 60000 / grid.bpm;
  const beats: number[] = [];
  const barStarts: number[] = [];
  // From the first bar line, which is where everything downstream counts
  // bars outward from.
  for (let at = grid.offsetMs, i = 0; at <= throughMs; at += beatMs, i += 1) {
    beats.push(at);
    if (grid.beatsPerBar > 0 && i % grid.beatsPerBar === 0) {
      barStarts.push(i);
    }
  }
  return { beats, barStarts, suspectGaps: [], isTapped: false };
}

/**
 * Where a moment sits in beats, fractionally.
 *
 * Interpolated between the two beats it falls between, so a beat lasts
 * exactly as long as it lasted. Outside the taps it carries on at the
 * speed of the nearest interval, which is the only honest extrapolation:
 * the person stopped tapping, they did not state a tempo for the rest.
 */
export function msToBeat(timeline: BeatTimeline, ms: number): number {
  const { beats } = timeline;
  if (beats.length === 0) {
    return 0;
  }
  if (beats.length === 1) {
    return 0;
  }
  if (ms <= beats[0]) {
    const first = beats[1] - beats[0];
    return first > 0 ? (ms - beats[0]) / first : 0;
  }
  const last = beats.length - 1;
  if (ms >= beats[last]) {
    const final = beats[last] - beats[last - 1];
    return final > 0 ? last + (ms - beats[last]) / final : last;
  }
  // Binary search for the interval this moment falls in.
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= ms) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const span = beats[hi] - beats[lo];
  return span > 0 ? lo + (ms - beats[lo]) / span : lo;
}

/** The inverse: where a fractional beat falls, in ms. */
export function beatToMs(timeline: BeatTimeline, beat: number): number {
  const { beats } = timeline;
  if (beats.length === 0) {
    return 0;
  }
  if (beats.length === 1) {
    return beats[0];
  }
  const last = beats.length - 1;
  if (beat <= 0) {
    return beats[0] + beat * (beats[1] - beats[0]);
  }
  if (beat >= last) {
    return beats[last] + (beat - last) * (beats[last] - beats[last - 1]);
  }
  const lo = Math.floor(beat);
  return beats[lo] + (beat - lo) * (beats[lo + 1] - beats[lo]);
}

/**
 * The bars, counted between the beats marked as downbeats.
 *
 * Beats before the first downbeat are a pickup and beats after the last
 * are a trailing part-bar; neither is padded out (INV-NOTES-199). With
 * nothing marked there are no bars, because one mark says where a bar
 * begins and nothing about how long one is.
 */
export function countedBars(timeline: BeatTimeline): CountedBar[] {
  const { barStarts, beats } = timeline;
  if (barStarts.length === 0 || beats.length === 0) {
    return [];
  }
  const out: CountedBar[] = [];
  if (barStarts[0] > 0) {
    out.push({
      index: 0,
      startBeat: 0,
      beatCount: barStarts[0],
      isPartial: true
    });
  }
  for (let i = 0; i < barStarts.length; i += 1) {
    const start = barStarts[i];
    const next = i + 1 < barStarts.length ? barStarts[i + 1] : beats.length;
    out.push({
      index: i + 1,
      startBeat: start,
      beatCount: next - start,
      // The last one runs to the end of the taps rather than to a mark, so
      // there is nothing saying it was finished.
      isPartial: i + 1 === barStarts.length
    });
  }
  return out;
}

/**
 * The time signature the counted bars imply, or null where they disagree.
 *
 * Read back rather than imposed (INV-NOTES-050). Partial bars are left
 * out of the vote: a pickup is short by definition and says nothing about
 * the metre.
 */
export function countedMetre(timeline: BeatTimeline): number | null {
  const whole = countedBars(timeline).filter((bar) => !bar.isPartial);
  if (whole.length === 0) {
    return null;
  }
  const first = whole[0].beatCount;
  return whole.every((bar) => bar.beatCount === first) ? first : null;
}

/**
 * The pulse these beats were tapped at: the middle, and the edges.
 *
 * One number for a take that breathes is a claim nobody made
 * (INV-NOTES-201). The median is here to be taken deliberately — for an
 * export, or a click — and taking it is a person's act.
 */
export function tappedTempo(timeline: BeatTimeline): TappedTempo | null {
  const intervals = beatIntervals(timeline).filter((ms) => ms > 0);
  if (intervals.length < MIN_FOR_TEMPO - 1) {
    return null;
  }
  return {
    medianBpm: 60000 / median(intervals),
    // The slowest beat is the longest interval, so the bpm order flips.
    slowestBpm: 60000 / Math.max(...intervals),
    fastestBpm: 60000 / Math.min(...intervals)
  };
}
