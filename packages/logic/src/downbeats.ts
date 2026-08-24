/**
 * downbeats — where a take's chords most likely begin, before anyone has said.
 *
 * A downbeat marks a place a new chord may start, so the honest way to
 * propose one is to look for where the implied harmony actually turns over
 * rather than to count out an even division of a detected tempo. The even
 * division is a guess about metre wearing the clothes of a reading; this is a
 * measurement (INV-NOTES-049).
 *
 * Everything here is a proposal. It is the opening position of an argument
 * the singer finishes by dragging, and it is wrong often enough that being
 * easy to correct matters more than being right.
 */
import { chordForSpan } from './chordMatch';
import type { Melody } from './analysis';
import { bassChangeTimes, bassSpans } from './bassContext';
import { readSungCount } from './sungCount';
import type { MusicalGrid } from './quantize';

export interface DownbeatOptions {
  /**
   * How many notes are weighed on each side of a candidate (default 4).
   *
   * Counted in notes rather than in milliseconds, because a chord is
   * established by notes: a fast passage packs six into two seconds and a
   * slow one holds two, and a fixed span reads the first as noise and the
   * second as silence. Three is the fewest that can spell a triad; four
   * gives it somewhere to be wrong.
   */
  notesPerSide?: number;
  /** Closest two downbeats may sit, in beats (default 1). */
  minGapBeats?: number;
  /** Chord set to read with (default 'triads'). */
  vocabulary?: 'triads' | 'sevenths';
  /**
   * A context layer sung against the take, when there is one.
   *
   * Given, it decides the downbeats outright: the chord lasts until the bass
   * moves, which is stated rather than inferred (INV-NOTES-072). Reading
   * harmonic rhythm out of a melody alone is the weakest step in this
   * pipeline and the one most often corrected by hand.
   */
  bass?: Melody;
  /**
   * How far gaps may differ from their median and still be called even, as a
   * fraction of that median (default 0.25). Nearly-even gaps are evened out;
   * uneven ones are left alone.
   */
  evenTolerance?: number;
}

/**
 * The fewest notes that can spell a chord, and so the fewest worth asking
 * about. Two notes are an interval, and an interval belongs to several
 * chords equally.
 */
const MIN_RUN = 3;

/** Notes in the order they were sung. */
function inTimeOrder(notes: Melody): Melody {
  return [...notes].sort((a, b) => a.startMs - b.startMs);
}

/**
 * Whether two runs of notes spell different chords.
 *
 * Each run is judged over its own span, so neither is read through a window
 * that happens to contain the other.
 */
function harmonyDiffers(
  before: Melody,
  after: Melody,
  vocabulary: 'triads' | 'sevenths'
): boolean {
  if (before.length === 0 || after.length === 0) {
    return false;
  }
  const spanOf = (run: Melody) => {
    let lo = Infinity;
    let hi = 0;
    for (const n of run) {
      if (n.startMs < lo) lo = n.startMs;
      if (n.endMs > hi) hi = n.endMs;
    }
    return { lo, hi };
  };
  const b = spanOf(before);
  const a = spanOf(after);
  const left = chordForSpan(before, b.lo, b.hi, { vocabulary });
  const right = chordForSpan(after, a.lo, a.hi, { vocabulary });
  if (!left || !right) {
    return false;
  }
  return left.rootPc !== right.rootPc || left.quality !== right.quality;
}

/**
 * Even out gaps that are already nearly even.
 *
 * Most people sing to a regular pulse, and a proposal that wobbles by a
 * semiquaver reads as wrong rather than as precise. A take whose gaps are
 * genuinely uneven is left alone — straightening that would be exactly the
 * rigid model this arrangement exists to avoid.
 */
export function evenOutIfClose(
  positions: readonly number[],
  tolerance: number
): number[] {
  if (positions.length < 3) {
    return [...positions];
  }
  const gaps: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    gaps.push(positions[i] - positions[i - 1]);
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (!(median > 0)) {
    return [...positions];
  }
  const wobbly = gaps.some((g) => Math.abs(g - median) > tolerance * median);
  if (wobbly) {
    return [...positions];
  }
  const out = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    out.push(positions[0] + i * median);
  }
  return out;
}

/**
 * Propose the downbeats of a take, as grid steps.
 *
 * Empty when there is nothing to read. Otherwise always at least one, at the
 * first note: a take has to start somewhere, and its first chord starts there.
 */
export function proposeDownbeats(
  notes: Melody,
  grid: MusicalGrid,
  options: DownbeatOptions = {}
): number[] {
  if (notes.length === 0 || !(grid.bpm > 0)) {
    return [];
  }
  const beatMs = 60000 / grid.bpm;
  const stepsPerBeat = grid.stepsPerBeat > 0 ? grid.stepsPerBeat : 4;
  const stepMs = beatMs / stepsPerBeat;
  const perSide = Math.max(2, Math.round(options.notesPerSide ?? 4));
  const minGapMs = beatMs * (options.minGapBeats ?? 1);
  const vocabulary = options.vocabulary ?? 'triads';

  const ordered = inTimeOrder(notes);

  // Stated beats inferred, and there are two kinds of statement. A sung bass
  // says where the harmony changes, which is what a downbeat marks, so it
  // wins outright. A count says where the bars are, which is the next best
  // thing when nobody sang the roots (INV-NOTES-112).
  if (options.bass && options.bass.length > 0) {
    return toSteps(
      bassChangeTimes(bassSpans(options.bass)),
      grid,
      stepMs,
      minGapMs,
      options.evenTolerance ?? 0.25
    );
  }

  if (grid.meterIsCounted) {
    return countedBars(ordered, grid, stepsPerBeat);
  }

  // Every note onset is a candidate — a chord starting in the middle of a
  // held note is almost never what was meant, so the onsets are the only
  // places worth asking about, and asking there needs no snapping afterwards.
  const boundaries: number[] = [ordered[0].startMs];
  for (let i = MIN_RUN; i + MIN_RUN <= ordered.length; i++) {
    // Shorter runs near the edges rather than no answer there: a six-note
    // idea would otherwise be too small to ask about at all.
    const before = ordered.slice(Math.max(0, i - perSide), i);
    const after = ordered.slice(i, Math.min(ordered.length, i + perSide));
    if (harmonyDiffers(before, after, vocabulary)) {
      boundaries.push(ordered[i].startMs);
    }
  }

  return toSteps(boundaries, grid, stepMs, minGapMs, options.evenTolerance ?? 0.25);
}

/**
 * Bar lines at the metre somebody counted, from where the count stopped.
 *
 * An even division, which is exactly what a count states: this tempo, this
 * many beats to a bar, starting here. The melodic reading below it is an
 * inference about harmony that also has to guess the phase, and the phase is
 * the part it gets wrong most — so where the phase has been stated outright,
 * guessing it again is throwing away the clearest thing in the take
 * (INV-NOTES-112).
 *
 * The counted beats themselves get no lines. They are real bars, but nothing
 * is sung over them, and a chord card on a bar of counting describes nothing.
 */
function countedBars(
  ordered: Melody,
  grid: MusicalGrid,
  stepsPerBeat: number
): number[] {
  const perBar = grid.beatsPerBar * stepsPerBeat;
  if (!(perBar > 0)) {
    return [];
  }
  const beatMs = 60000 / grid.bpm;
  const stepMs = beatMs / stepsPerBeat;
  const count = readSungCount(ordered);
  // The first bar line at or after the counting stopped. A count of exactly
  // one bar lands its last beat on the first bar line of the music, which is
  // the one that means "here" rather than "soon".
  const from = count != null ? count.endMs - beatMs / 2 : ordered[0].startMs;
  const lastMs = ordered[ordered.length - 1].endMs;
  const firstBar = Math.max(
    0,
    Math.ceil((from - grid.offsetMs) / (perBar * stepMs))
  );
  const steps: number[] = [];
  for (let bar = firstBar; ; bar++) {
    const step = bar * perBar;
    if (grid.offsetMs + step * stepMs > lastMs) {
      break;
    }
    steps.push(step);
  }
  // A take has to start somewhere: if the counting ran past everything sung,
  // the first bar of the music is still a downbeat.
  return steps.length > 0 ? steps : [firstBar * perBar];
}

/**
 * Moments to grid steps: thinned to the minimum gap, evened when they are
 * nearly even already, and deduplicated.
 *
 * One implementation, because a stated downbeat and an inferred one must land
 * on the grid the same way or the two paths would disagree about where the
 * same moment is.
 */
function toSteps(
  moments: readonly number[],
  grid: MusicalGrid,
  stepMs: number,
  minGapMs: number,
  evenTolerance = 0.25
): number[] {
  const kept: number[] = [];
  for (const moment of moments) {
    if (kept.length === 0 || moment - kept[kept.length - 1] >= minGapMs) {
      kept.push(moment);
    }
  }
  const evened = evenOutIfClose(kept, evenTolerance);
  const steps = evened.map((ms) =>
    Math.max(0, Math.round((ms - grid.offsetMs) / stepMs))
  );
  return Array.from(new Set(steps)).sort((a, b) => a - b);
}
