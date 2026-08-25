/**
 * The grid a handful of taps implies.
 *
 * Taps are sparse by design — nobody taps every beat of every take — so the
 * gaps between them are whole numbers of beats rather than single beats, and a
 * grid has to be fitted to them rather than read off them (INV-NOTES-131).
 * Four taps a bar apart are four beats at a quarter of the tempo if you read
 * them naively, and reading them naively is exactly what a median of adjacent
 * gaps does.
 *
 * Once fitted, the grid runs the length of the take: every beat between the
 * taps and beyond them follows from it, and so do the bars.
 *
 * Separate from the taps themselves because these are two different jobs —
 * one holds what a person did, the other works out what it means.
 */
import type { TappedBeat } from './tappedBeats';

/** Fewer than this and there is no grid to fit, only a moment. */
const MIN_FOR_TEMPO = 3;

/** The slowest and fastest a tapped pulse is taken to be, in ms per beat. */
const SLOWEST_MS = 60000 / 30;
const FASTEST_MS = 60000 / 300;

/** How many beats a single gap may span. Beyond this it is a rest, not a beat. */
const MAX_SPAN = 8;

/** A tap this far from where the grid says a beat is does not belong to it. */
const FIT_TOLERANCE = 0.22;

export interface TappedTempo {
  bpm: number;
  /** 0..1 — how well the taps sit on the grid they imply. */
  confidence: number;
  /**
   * Where the grid's beat zero sits — and, where a bar was marked, a bar
   * start too. Bars are laid from this offset by everything downstream, so a
   * phase that lands mid-bar would put every bar line in the wrong place.
   */
  offsetMs: number;
  /** Beats to a bar, where enough were marked to say. Null otherwise. */
  beatsPerBar: number | null;
  /** One beat, in ms. The same thing as bpm, without the round trip. */
  beatMs: number;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * How badly a set of taps misses a grid of this period, and where it sits.
 *
 * Every tap is assigned to its nearest beat of the grid and the error is the
 * average miss, as a fraction of a beat. The phase is taken from the taps
 * themselves rather than searched for: the average of how far each tap sits
 * from its own nearest beat IS the offset that would centre them.
 */
function fitOf(
  at: readonly number[],
  beatMs: number
): { error: number; offsetMs: number } {
  const first = at[0];
  let shift = 0;
  for (const tap of at) {
    const beats = (tap - first) / beatMs;
    shift += (beats - Math.round(beats)) * beatMs;
  }
  const offsetMs = first + shift / at.length;
  let miss = 0;
  for (const tap of at) {
    const beats = (tap - offsetMs) / beatMs;
    miss += Math.abs(beats - Math.round(beats));
  }
  return { error: miss / at.length, offsetMs };
}

/**
 * The grid a set of taps implies.
 *
 * The taps are sparse, so the gaps between them are whole numbers of beats
 * rather than single beats. Every gap is therefore a candidate period divided
 * by some small integer, and the right period is the one that explains every
 * tap at once (INV-NOTES-131).
 *
 * Where a tempo was read from the music, it settles the one thing the taps
 * cannot: whether a tapped pulse is the beat or every second or fourth one.
 * Four taps a bar apart fit a grid of one beat per bar perfectly well, and
 * nothing in the taps alone says otherwise — but the melody's own onsets do.
 *
 * Null below three taps. Two are an interval, and an interval alone says
 * nothing about whether it would have happened again.
 */
export function tempoFromBeats(
  beats: readonly TappedBeat[],
  /** The tempo read from the music, where there is one, in bpm. */
  heardBpm = 0
): TappedTempo | null {
  const at = [...beats].map((b) => b.atMs).sort((a, b) => a - b);
  if (at.length < MIN_FOR_TEMPO) {
    return null;
  }

  // Every gap, divided every plausible way, is a period worth trying. The
  // true period divides every gap into a near-integer; a wrong one does not.
  const candidates = new Set<number>();
  for (let i = 1; i < at.length; i++) {
    const gap = at[i] - at[i - 1];
    for (let span = 1; span <= MAX_SPAN; span++) {
      const period = gap / span;
      if (period >= FASTEST_MS && period <= SLOWEST_MS) {
        candidates.add(period);
      }
    }
  }
  if (candidates.size === 0) {
    return null;
  }

  let best: { beatMs: number; error: number; offsetMs: number } | null = null;
  for (const beatMs of candidates) {
    const fit = fitOf(at, beatMs);
    if (fit.error > FIT_TOLERANCE) {
      continue;
    }
    // Among the periods that explain the taps, the longest is the honest one:
    // a period half as long explains them just as well while inventing a beat
    // between every pair, which nobody tapped and nothing else supports.
    if (best == null || beatMs > best.beatMs) {
      best = { beatMs, error: fit.error, offsetMs: fit.offsetMs };
    }
  }
  if (best == null) {
    return null;
  }

  const beatMs = withHeard(best.beatMs, heardBpm);
  const fit = fitOf(at, beatMs);
  return {
    beatMs,
    bpm: 60000 / beatMs,
    offsetMs: phasedOnBar(fit.offsetMs, beatMs, beats),
    // How well the taps sit on the grid they imply, not how evenly they were
    // spaced: sparse taps are unevenly spaced by design.
    confidence: Math.max(0, Math.min(1, 1 - fit.error / FIT_TOLERANCE)),
    beatsPerBar: barLengthOf(beats, beatMs)
  };
}

/**
 * The same grid, named from a bar start rather than from wherever it began.
 *
 * A phase is only ever one beat of many and any of them describes the grid
 * equally well — but bars are counted outward from this one, so where somebody
 * said "a bar starts here", that is the beat the grid should be named after
 * (INV-NOTES-131). The grid itself does not move; only which of its beats is
 * called zero.
 */
function phasedOnBar(
  offsetMs: number,
  beatMs: number,
  beats: readonly TappedBeat[]
): number {
  const marked = [...beats]
    .filter((beat) => beat.isDownbeat)
    .sort((a, b) => a.atMs - b.atMs)[0];
  if (marked == null) {
    return offsetMs;
  }
  const n = Math.round((marked.atMs - offsetMs) / beatMs);
  return offsetMs + n * beatMs;
}

/**
 * The tapped period, resolved against what the music was heard at.
 *
 * Taps pin the phase exactly and the period only up to a factor: somebody
 * tapping every bar and somebody tapping every beat produce the same evidence
 * about where beats are, and differ only in how many lie between. The reading
 * from the melody is poor at phase and decent at rate, so each supplies what
 * the other lacks (INV-NOTES-131).
 */
function withHeard(tappedMs: number, heardBpm: number): number {
  if (!(heardBpm > 0)) {
    return tappedMs;
  }
  const heardMs = 60000 / heardBpm;
  let best = tappedMs;
  let closest = Math.abs(Math.log2(tappedMs / heardMs));
  // Only whole multiples and divisors: a tapped pulse is some number of beats,
  // or a beat is some number of taps. Nothing in between is musical.
  for (const factor of [2, 3, 4, 6, 8]) {
    for (const period of [tappedMs / factor, tappedMs * factor]) {
      if (period < FASTEST_MS || period > SLOWEST_MS) {
        continue;
      }
      const distance = Math.abs(Math.log2(period / heardMs));
      if (distance < closest) {
        closest = distance;
        best = period;
      }
    }
  }
  return best;
}

/**
 * How many beats to a bar, from the beats marked as bar starts.
 *
 * Measured in beats of the fitted grid rather than in taps between marks: the
 * marks are as sparse as everything else, and two marks a bar apart with no
 * taps between them still state a bar length (INV-NOTES-131).
 *
 * Null unless two bars were marked — one mark says where a bar begins and
 * nothing at all about how long one is.
 */
function barLengthOf(
  beats: readonly TappedBeat[],
  beatMs: number
): number | null {
  const marked = [...beats]
    .filter((beat) => beat.isDownbeat)
    .map((beat) => beat.atMs)
    .sort((a, b) => a - b);
  if (marked.length < 2 || !(beatMs > 0)) {
    return null;
  }
  const spans: number[] = [];
  for (let i = 1; i < marked.length; i++) {
    spans.push(Math.round((marked[i] - marked[i - 1]) / beatMs));
  }
  const bar = Math.round(median(spans));
  return bar > 0 ? bar : null;
}

/** A beat of the take: where it is, and whether a person put it there. */
export interface Beat {
  atMs: number;
  /** True where somebody tapped this one rather than it being inferred. */
  isTapped: boolean;
  isDownbeat: boolean;
}

/**
 * Every beat of the take, tapped and inferred together.
 *
 * The taps are the evidence and this is what follows from them: the grid runs
 * the length of the recording, whether four beats were tapped or forty
 * (INV-NOTES-131). A beat somebody actually tapped is marked as such, because
 * a beat that was stated and a beat that was worked out are different claims
 * and the drawing says so.
 */
export function beatsAcross(
  tapped: readonly TappedBeat[],
  grid: TappedTempo,
  durationMs: number
): Beat[] {
  if (!(grid.beatMs > 0) || !(durationMs > 0)) {
    return [];
  }
  const bar = grid.beatsPerBar ?? 0;
  const firstMarked = [...tapped]
    .filter((beat) => beat.isDownbeat)
    .sort((a, b) => a.atMs - b.atMs)[0];

  const out: Beat[] = [];
  const from = Math.ceil((0 - grid.offsetMs) / grid.beatMs);
  for (let n = from; ; n++) {
    const atMs = grid.offsetMs + n * grid.beatMs;
    if (atMs > durationMs) {
      break;
    }
    if (atMs < 0) {
      continue;
    }
    const tap = tapped.find(
      (beat) => Math.abs(beat.atMs - atMs) < grid.beatMs * FIT_TOLERANCE
    );
    // A bar falls every `bar` beats from the first one marked. Where nothing
    // was marked there are no bars to place, only beats.
    const isDownbeat =
      tap?.isDownbeat === true ||
      (bar > 0 &&
        firstMarked != null &&
        Math.abs(
          Math.round((atMs - firstMarked.atMs) / grid.beatMs) % bar
        ) === 0);
    out.push({ atMs, isTapped: tap != null, isDownbeat });
  }
  return out;
}

/** The moments a bar begins, tapped and inferred together. */
export function downbeatsFromBeats(
  tapped: readonly TappedBeat[],
  grid: TappedTempo | null = null,
  durationMs = 0
): number[] {
  if (grid == null || durationMs <= 0) {
    return [...tapped]
      .sort((a, b) => a.atMs - b.atMs)
      .filter((beat) => beat.isDownbeat)
      .map((beat) => beat.atMs);
  }
  return beatsAcross(tapped, grid, durationMs)
    .filter((beat) => beat.isDownbeat)
    .map((beat) => beat.atMs);
}
