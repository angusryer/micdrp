/**
 * Fit a metrical grid to a sung take and express its notes against that grid.
 *
 * This is what turns a list of onset timestamps into something notatable: a
 * time signature, bar and beat positions, and rhythmic durations.
 *
 * The governing rule is that quantization changes the NOTATION and never the
 * PERFORMANCE. A singer with good time does not want their take rewritten;
 * they want to see it written down correctly. So every note keeps the
 * millisecond timings it was actually sung with, and gains grid-relative
 * values alongside them. Playback can stay faithful to the take, notation can
 * be clean, and `deviationMs` says exactly where the two disagree — which is
 * useful feedback rather than an error to be hidden.
 *
 * Metre is inferred the same way the pulse is (see `tempo.ts`): by asking, for
 * each candidate bar length, how tightly the heavy onsets cluster at one phase
 * of it. Notes are weighted by duration, because a long note is far more
 * likely to sit on a downbeat than a passing sixteenth.
 *
 * Pure, dependency-free, ES5-safe Math only.
 */

import type { NoteEvent } from './segmentation';
import {
  calibrateConfidence,
  choosePulsesPerBeat,
  effectiveCount,
  fitPulse,
  MAX_BPM,
  MIN_BPM
} from './tempo';

/**
 * Candidate bar lengths in beats, shortest first.
 *
 * Deliberately excludes 6. A short unaccompanied take rarely carries enough
 * evidence to distinguish 6/4 from 3/4, and offering 6 meant it won on noise
 * for a quarter of a real corpus — 6/4 is rare enough in practice that
 * inferring it from weak evidence is more often wrong than right. Compound
 * time still arises, through a ternary SUBDIVISION of a two- or three-beat
 * bar, which is what actually distinguishes 6/8 from 3/4.
 */
const BEATS_PER_BAR = [2, 3, 4];
/** Another metre has to clearly beat 4/4 to be chosen over it. */
const NON_FOUR_BIAS = 0.88;

/**
 * Grid steps per beat used for snapping. Sixteenths in simple metre, and
 * sixths of a beat in compound so that both the three-way division and its
 * halves land on the grid.
 */
const SIMPLE_STEPS_PER_BEAT = 4;
const COMPOUND_STEPS_PER_BEAT = 6;

export interface MusicalGrid {
  bpm: number;
  /** Time of the first bar line, in ms. */
  offsetMs: number;
  beatsPerBar: number;
  /** True when each beat divides into three rather than two. */
  isCompound: boolean;
  /** Grid steps per beat used when snapping. */
  stepsPerBeat: number;
  /** e.g. "4/4", "3/4", "6/8". */
  timeSignature: string;
  /** 0..1 — how well the onsets support this tempo and phase. */
  confidence: number;
  /**
   * 0..1 — how well they support the TIME SIGNATURE specifically, which is a
   * much weaker inference than tempo.
   */
  meterConfidence: number;
  /**
   * False when `timeSignature` is the 4/4 default rather than something
   * measured. A UI should present an unstated metre as an assumption open to
   * correction, not as a finding.
   */
  meterIsStated: boolean;
}

export interface QuantizedNote extends NoteEvent {
  /** Onset snapped to the grid, in ms. */
  gridStartMs: number;
  /** Duration in grid steps, always at least one. */
  gridDurationMs: number;
  /** Signed ms the singer was early (negative) or late (positive). */
  deviationMs: number;
  /** 1-based bar this note starts in. */
  bar: number;
  /** 1-based beat within the bar, fractional. */
  beat: number;
  /** Notated length in beats. */
  durationBeats: number;
  /** e.g. "quarter", "dotted eighth". */
  durationLabel: string;
}

export interface QuantizeResult {
  grid: MusicalGrid;
  notes: QuantizedNote[];
  /**
   * Median absolute deviation from the fitted grid, in ms.
   *
   * Read this as "how much snapping was applied", not as "how good the
   * singer's time was". The grid is chosen to fit these very onsets, so it
   * absorbs a consistent lag or a slightly different tempo rather than
   * reporting it. Judging timing needs a reference tempo the singer was
   * actually given — which is what the Practice module has and Notes does not.
   */
  medianDeviationMs: number;
}

/**
 * Below this confidence the metre is a guess, so we say 4/4 and admit it.
 *
 * Calibrated by measurement, not taste. Synthetic melodies with a genuine
 * duration accent score 0.26-0.36; melodies with no accent at all score 0.00;
 * randomly placed notes reach 0.20 at worst. 0.25 sits above what noise
 * achieves and below what a real metre does.
 *
 * Over a corpus of real sung takes the median is 0.17, so most short melodic
 * ideas will fall back — which is the honest outcome: they genuinely do not
 * state their metre. `MusicalGrid.meterConfidence` reports which case a take
 * is in, so a UI can invite a correction rather than present a guess as a
 * finding.
 */
const METER_MIN_CONFIDENCE = 0.25;

/** Notated lengths in beats, longest first. */
const SIMPLE_DURATIONS: [number, string][] = [
  [4, 'whole'],
  [3, 'dotted half'],
  [2, 'half'],
  [1.5, 'dotted quarter'],
  [1, 'quarter'],
  [0.75, 'dotted eighth'],
  [0.5, 'eighth'],
  [0.25, 'sixteenth']
];

/**
 * In compound metre the beat is a dotted quarter, so its natural divisions are
 * thirds rather than halves.
 */
const COMPOUND_DURATIONS: [number, string][] = [
  [4, 'double dotted half'],
  [2, 'dotted half'],
  [1, 'dotted quarter'],
  [2 / 3, 'quarter'],
  [0.5, 'dotted eighth'],
  [1 / 3, 'eighth'],
  [1 / 6, 'sixteenth']
];

function labelForBeats(beats: number, isCompound: boolean): string {
  const table = isCompound ? COMPOUND_DURATIONS : SIMPLE_DURATIONS;
  let bestLabel = table[table.length - 1][1];
  let bestDistance = Infinity;
  for (const entry of table) {
    const distance = Math.abs(entry[0] - beats);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLabel = entry[1];
    }
  }
  return bestLabel;
}

/**
 * How many beats to a bar, and which beat is beat one.
 *
 * Asking how tightly onsets cluster at one phase of the bar — the measure that
 * finds the pulse — is the wrong question here, and scores a flawless waltz at
 * zero. Real music puts notes on EVERY beat; what marks a downbeat is that it
 * is ACCENTED, not that its neighbours are empty. Three evenly spaced clusters
 * cancel out to nothing.
 *
 * So instead each onset is assigned to a beat, beats are bucketed by their
 * position within a candidate bar, and the buckets are compared: if one beat
 * class consistently carries more weight than the others, that is the
 * downbeat and that is the bar length. Weight is raw note duration, since a
 * held note is the clearest accent an unaccompanied voice has.
 */
function fitBar(
  onsets: readonly number[],
  durations: readonly number[],
  beatMs: number,
  beatPhaseMs: number
): { beatsPerBar: number; offsetMs: number; strength: number } {
  let best = { beatsPerBar: 4, offsetMs: beatPhaseMs, strength: 0 };

  for (const count of BEATS_PER_BAR) {
    const buckets: number[] = [];
    for (let i = 0; i < count; i++) {
      buckets.push(0);
    }
    let total = 0;
    for (let i = 0; i < onsets.length; i++) {
      const beatIndex = Math.round((onsets[i] - beatPhaseMs) / beatMs);
      let slot = beatIndex % count;
      if (slot < 0) {
        slot += count;
      }
      buckets[slot] += durations[i];
      total += durations[i];
    }
    if (total <= 0) {
      continue;
    }

    let heaviest = 0;
    let heaviestSlot = 0;
    for (let i = 0; i < count; i++) {
      if (buckets[i] > heaviest) {
        heaviest = buckets[i];
        heaviestSlot = i;
      }
    }
    // How far the heaviest beat class stands above an even spread, scaled so
    // that 0 is perfectly flat and 1 is all the weight on a single beat.
    const mean = total / count;
    const strength = mean > 0 ? (heaviest / mean - 1) / (count - 1) : 0;
    const score = strength * (count === 4 ? 1 : NON_FOUR_BIAS);

    if (score > best.strength) {
      best = {
        beatsPerBar: count,
        offsetMs: beatPhaseMs + heaviestSlot * beatMs,
        strength: score
      };
    }
  }
  return best;
}

/** Fit a complete metrical grid — tempo, phase, subdivision and metre. */
export function fitGrid(notes: readonly NoteEvent[]): MusicalGrid {
  const sorted = notes.slice().sort(function (a, b) {
    return a.startMs - b.startMs;
  });
  const onsets: number[] = [];
  const weights: number[] = [];
  const durations: number[] = [];
  for (const event of sorted) {
    onsets.push(event.startMs);
    weights.push(Math.sqrt(Math.max(event.durationMs, 1)));
    durations.push(Math.max(event.durationMs, 1));
  }

  if (onsets.length < 2) {
    return {
      bpm: 0,
      offsetMs: 0,
      beatsPerBar: 4,
      isCompound: false,
      stepsPerBeat: SIMPLE_STEPS_PER_BEAT,
      timeSignature: '4/4',
      confidence: 0,
      meterConfidence: 0,
      meterIsStated: false
    };
  }

  const pulse = fitPulse(onsets, weights);
  const beat = choosePulsesPerBeat(pulse.periodMs);
  const beatMs = pulse.periodMs * beat.pulsesPerBeat;
  const bar = fitBar(onsets, durations, beatMs, pulse.offsetMs % beatMs);
  const support = effectiveCount(weights);
  const meterConfidence = bar.strength;
  // Without real evidence for a metre, say the one a musician would assume.
  // The ternary-subdivision reading rests on the same thin evidence as the bar
  // length, so an unsupported metre falls back to simple 4/4 in full. Keeping
  // the compound flag while forcing four beats produced 12/8 — a stronger
  // claim than either piece of evidence supports.
  const stated = meterConfidence >= METER_MIN_CONFIDENCE;
  const beatsPerBar = stated ? bar.beatsPerBar : 4;
  const isCompound = stated && beat.isCompound;

  const bpm = Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, 60000 / beatMs)));
  // Compound metre notates its beat as a dotted quarter, so a bar of two such
  // beats is written 6/8 rather than 2/4.
  const timeSignature = isCompound ? `${beatsPerBar * 3}/8` : `${beatsPerBar}/4`;

  return {
    bpm: bpm,
    // An unstated metre still has a known PHASE — we just do not know which
    // beat is beat one. Falling back to zero would misalign every snap, so the
    // beat phase stands in for the bar line.
    offsetMs: Math.round(stated ? bar.offsetMs : pulse.offsetMs),
    beatsPerBar: beatsPerBar,
    isCompound: isCompound,
    stepsPerBeat: isCompound ? COMPOUND_STEPS_PER_BEAT : SIMPLE_STEPS_PER_BEAT,
    timeSignature: timeSignature,
    confidence: calibrateConfidence(pulse.strength, support),
    meterConfidence: meterConfidence,
    meterIsStated: stated
  };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort(function (a, b) {
    return a - b;
  });
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Express each note against the grid.
 *
 * Performed `startMs`/`endMs`/`durationMs` are passed through untouched. The
 * grid-relative values are added alongside, so nothing about the take is lost
 * and a caller chooses which view it wants.
 */
export function quantizeNotes(
  notes: readonly NoteEvent[],
  grid: MusicalGrid
): QuantizedNote[] {
  if (grid.bpm <= 0) {
    return [];
  }
  const beatMs = 60000 / grid.bpm;
  const stepMs = beatMs / grid.stepsPerBeat;

  const sorted = notes.slice().sort(function (a, b) {
    return a.startMs - b.startMs;
  });

  // Snap every onset first, so a note's length can be measured against where
  // the NEXT note actually begins.
  const startSteps: number[] = [];
  for (const note of sorted) {
    startSteps.push(Math.round((note.startMs - grid.offsetMs) / stepMs));
  }

  const out: QuantizedNote[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const note = sorted[i];
    const startStep = startSteps[i];
    const gridStartMs = grid.offsetMs + startStep * stepMs;

    // Round the DURATION itself rather than differencing two independently
    // rounded endpoints. Differencing lets a note's notated length flip
    // between a quarter and a dotted eighth purely because the singer entered
    // a few milliseconds early — the length would encode the drift instead of
    // the rhythm. A note is at least one step long, so nothing vanishes.
    let steps = Math.max(1, Math.round(note.durationMs / stepMs));
    // A monophonic line cannot overlap itself: never notate past the next onset.
    if (i + 1 < startSteps.length) {
      const available = startSteps[i + 1] - startStep;
      if (available >= 1 && steps > available) {
        steps = available;
      }
    }
    const gridDurationMs = steps * stepMs;

    const beatsFromOrigin = startStep / grid.stepsPerBeat;
    // Bars are numbered from the first bar line, and a pickup sung before it
    // belongs to bar 0 rather than to a nonexistent bar -1.
    const barIndex = Math.floor(beatsFromOrigin / grid.beatsPerBar);
    let beatInBar = beatsFromOrigin - barIndex * grid.beatsPerBar;
    if (beatInBar < 0) {
      beatInBar += grid.beatsPerBar;
    }

    const durationBeats = steps / grid.stepsPerBeat;
    out.push({
      midi: note.midi,
      startMs: note.startMs,
      endMs: note.endMs,
      durationMs: note.durationMs,
      cents: note.cents,
      clarity: note.clarity,
      loudnessDb: note.loudnessDb,
      gridStartMs: Math.round(gridStartMs),
      gridDurationMs: Math.round(gridDurationMs),
      deviationMs: Math.round(note.startMs - gridStartMs),
      bar: barIndex + 1,
      beat: beatInBar + 1,
      durationBeats: durationBeats,
      durationLabel: labelForBeats(durationBeats, grid.isCompound)
    });
  }
  return out;
}

/** Fit a grid to a take and express its notes against it. */
export function quantize(notes: readonly NoteEvent[]): QuantizeResult {
  const grid = fitGrid(notes);
  const quantized = quantizeNotes(notes, grid);
  const deviations: number[] = [];
  for (const note of quantized) {
    deviations.push(Math.abs(note.deviationMs));
  }
  const medianDeviationMs = median(deviations);
  return { grid: grid, notes: quantized, medianDeviationMs: medianDeviationMs };
}
