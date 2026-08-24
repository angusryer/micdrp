/**
 * The sounds in a take that are hits rather than notes.
 *
 * A mouth drum is not a quiet note or a badly sung one — it is a different
 * kind of event, with no pitch to report and nothing for the harmony to read.
 * Until now every one of them was discarded twice over: the voicing floor
 * threw them out for having no periodicity, and the brevity filter threw out
 * whatever survived for being too short (INV-PITCH-025).
 *
 * What identifies one is the absence of the thing notes have, plus the
 * presence of two things silence does not: it is loud, it is unpitched, and it
 * is over quickly. What KIND of hit it is comes from where its energy sits — a
 * "puh" and a "tss" are both unvoiced and both brief, and differ in nothing
 * else the engine reports.
 *
 * "Unpitched" is now asked directly. Spectral flatness says whether a sound
 * has a tone in it at all; periodicity says how well the waveform correlates
 * with itself, which answers the same question only by inference and gets it
 * wrong on anything breathy (INV-PITCH-026).
 *
 * Best effort, and named that way on purpose. A take is a person switching
 * between humming and drumming without announcing it, so this has to guess;
 * a track recorded as drums does not, and can be read with the guessing
 * turned off (INV-NOTES-115).
 */
import type { PitchFrame } from './segmentation';

/** What a hit sounded like, by where its energy sat. */
export type HitKind = 'thump' | 'tap' | 'hiss' | 'unknown';

export interface Hit {
  /** When it landed. A hit is a moment, not a span you can hold. */
  atMs: number;
  durationMs: number;
  /** How hard it was struck, in dBFS. */
  loudnessDb: number;
  /** Where its energy sat, or null when nothing measured it. */
  centroidHz: number | null;
  /** How noise-like it was, 0..1, or null when nothing measured it. */
  flatness: number | null;
  kind: HitKind;
  /** 0..1 — how much this looked like a hit rather than a clipped note. */
  confidence: number;
}

export interface PercussionOptions {
  /** How far above silence a sound must be to be a hit (default -45dBFS). */
  minLevelDb?: number;
  /** Longer than this and it is a note being sung badly (default 140ms). */
  maxDurationMs?: number;
  /** More periodic than this and it is pitched (default 0.5). */
  maxClarity?: number;
  /**
   * Flatter than this and the sound has no tone in it, whatever the
   * periodicity said (default 0.25). The direct question.
   */
  minFlatness?: number;
  /** Below this a hit is a thump; above `hissAboveHz` it is a hiss. */
  thumpBelowHz?: number;
  hissAboveHz?: number;
}

/** A run of frames that might be one hit. */
interface Run {
  fromMs: number;
  toMs: number;
  peakDb: number;
  centroid: number[];
  flatness: number[];
}

function classify(
  centroidHz: number | null,
  thumpBelow: number,
  hissAbove: number
): HitKind {
  if (centroidHz == null) {
    return 'unknown';
  }
  if (centroidHz < thumpBelow) {
    return 'thump';
  }
  return centroidHz > hissAbove ? 'hiss' : 'tap';
}

const mean = (values: readonly number[]): number | null =>
  values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

/**
 * How sure we are this was struck rather than sung.
 *
 * Shorter is surer, because a real note cannot be over that fast, and a note
 * clipped short by the detector usually is not either. Length is the strongest
 * evidence available and the only one that does not also describe a whisper.
 */
function sureness(durationMs: number, maxDurationMs: number): number {
  return Math.max(0, Math.min(1, 1 - durationMs / maxDurationMs));
}

/**
 * The hits in a take.
 *
 * Frames with no measured level yield nothing at all: without loudness there
 * is no way to tell a hit from the detector losing the pitch for a moment,
 * and guessing would fill every take with phantom drums (INV-PITCH-020).
 */
export function readPercussion(
  frames: readonly PitchFrame[],
  options: PercussionOptions = {}
): Hit[] {
  const minLevel = options.minLevelDb ?? -45;
  const maxDuration = options.maxDurationMs ?? 140;
  const maxClarity = options.maxClarity ?? 0.5;
  const minFlatness = options.minFlatness ?? 0.25;
  const thumpBelow = options.thumpBelowHz ?? 700;
  const hissAbove = options.hissAboveHz ?? 3500;

  const hits: Hit[] = [];
  let run: Run | null = null;

  const finish = (endMs: number): void => {
    if (run == null) {
      return;
    }
    const durationMs = endMs - run.fromMs;
    if (durationMs > 0 && durationMs <= maxDuration) {
      const centroidHz = mean(run.centroid);
      hits.push({
        atMs: run.fromMs,
        durationMs,
        loudnessDb: run.peakDb,
        centroidHz,
        flatness: mean(run.flatness),
        kind: classify(centroidHz, thumpBelow, hissAbove),
        confidence: sureness(durationMs, maxDuration)
      });
    }
    run = null;
  };

  for (const frame of frames) {
    const loud = frame.levelDb != null && frame.levelDb >= minLevel;
    // Unpitched. Flatness answers this directly where it was measured: a
    // sound with no tone in it is flat, whatever its waveform happened to
    // correlate with. Where it was not, fall back to periodicity, which is
    // what older takes have (INV-PITCH-026).
    const unpitched =
      frame.flatness != null
        ? frame.flatness >= minFlatness
        : frame.midi == null || frame.clarity < maxClarity;
    if (!loud || !unpitched) {
      finish(frame.timestampMs);
      continue;
    }
    if (run == null) {
      run = {
        fromMs: frame.timestampMs,
        toMs: frame.timestampMs,
        peakDb: frame.levelDb as number,
        centroid: [],
        flatness: []
      };
    }
    run.toMs = frame.timestampMs;
    run.peakDb = Math.max(run.peakDb, frame.levelDb as number);
    // Zero means "nothing to state" rather than "very low", so it is left out
    // rather than dragging the average down (INV-PITCH-026).
    if (frame.centroidHz != null && frame.centroidHz > 0) {
      run.centroid.push(frame.centroidHz);
    }
    if (frame.flatness != null) {
      run.flatness.push(frame.flatness);
    }
  }
  // A take that ends mid-hit still ends the hit.
  if (run != null) {
    finish(run.toMs);
  }
  return hits;
}
