/**
 * chordMatch — what chord a single stretch of melody implies.
 *
 * Extracted from analysis so that one implementation answers the question for
 * both callers: the even sweep that `impliedHarmony` runs across a whole
 * take, and the arbitrary, unequal spans that a person's own downbeats carve
 * it into. Two copies of this scoring would drift the first time a template
 * was tuned, and the two answers would then disagree about the same music.
 *
 * Scores are window-size invariant — the histogram is normalised — so a span
 * of half a second and one of six seconds are judged on the same footing.
 */
import type { ChordQuality } from './analysis';

/** Weighted pitch-class templates (offset from root -> perceptual weight). */
export interface ChordTemplate {
  quality: ChordQuality;
  /** [offsetSemitones, weight] chord tones; root is weighted highest. */
  tones: ReadonlyArray<readonly [number, number]>;
}

export const TRIAD_TEMPLATES: readonly ChordTemplate[] = [
  { quality: 'maj', tones: [[0, 3], [4, 2], [7, 2]] },
  { quality: 'min', tones: [[0, 3], [3, 2], [7, 2]] },
  { quality: 'dim', tones: [[0, 3], [3, 2], [6, 2]] },
  { quality: 'aug', tones: [[0, 3], [4, 2], [8, 2]] }
];

export const SEVENTH_TEMPLATES: readonly ChordTemplate[] = [
  { quality: 'maj7', tones: [[0, 3], [4, 2], [7, 1.5], [11, 1.5]] },
  { quality: 'dom7', tones: [[0, 3], [4, 2], [7, 1.5], [10, 1.5]] },
  { quality: 'min7', tones: [[0, 3], [3, 2], [7, 1.5], [10, 1.5]] },
  { quality: 'm7b5', tones: [[0, 3], [3, 2], [6, 1.5], [10, 1.5]] },
  { quality: 'dim7', tones: [[0, 3], [3, 2], [6, 1.5], [9, 1.5]] }
];

/**
 * How hard a note outside the chord counts against it.
 *
 * Without this a template that covers more pitch classes always wins, since
 * every extra tone can only add mass.
 */
const OFF_CHORD_PENALTY = 0.5;

export function templateWeightLookup(
  template: ChordTemplate
): Map<number, number> {
  const map = new Map<number, number>();
  for (const [offset, weight] of template.tones) {
    map.set(((offset % 12) + 12) % 12, weight);
  }
  return map;
}

/** The minimum a note needs from this module: a pitch and a span. */
export interface SpanNote {
  midi: number;
  startMs: number;
  endMs: number;
}

export interface SpanMatch {
  rootPc: number;
  quality: ChordQuality;
  /** How far clear of the runner-up, 0..1. */
  confidence: number;
}

export interface SpanMatchOptions {
  vocabulary?: 'triads' | 'sevenths';
  /** Precomputed lookups, when matching many spans in a row. */
  templates?: readonly ChordTemplate[];
  lookups?: readonly Map<number, number>[];
}

/**
 * Duration-weighted pitch-class histogram for the notes overlapping a span.
 * Null when nothing sounds there, which is not the same as a chord nobody
 * recognises.
 */
export function pitchClassMass(
  notes: readonly SpanNote[],
  startMs: number,
  endMs: number
): number[] | null {
  const pc = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const n of notes) {
    const overlap = Math.min(n.endMs, endMs) - Math.max(n.startMs, startMs);
    if (overlap <= 0) {
      continue;
    }
    pc[((Math.round(n.midi) % 12) + 12) % 12] += overlap;
    total += overlap;
  }
  if (total === 0) {
    return null;
  }
  for (let i = 0; i < 12; i++) {
    pc[i] /= total; // normalised, so scores do not depend on span length
  }
  return pc;
}

/**
 * The chord a span of melody implies, or null when nothing sounds in it.
 *
 * Confidence is how far the winner sits clear of the runner-up, which says
 * more than the raw score: a stretch that fits three chords equally well is
 * a stretch the singer has not committed to yet.
 */
export function chordForSpan(
  notes: readonly SpanNote[],
  startMs: number,
  endMs: number,
  options: SpanMatchOptions = {}
): SpanMatch | null {
  const pc = pitchClassMass(notes, startMs, endMs);
  if (!pc) {
    return null;
  }
  const templates =
    options.templates ??
    (options.vocabulary === 'sevenths' ? SEVENTH_TEMPLATES : TRIAD_TEMPLATES);
  const lookups = options.lookups ?? templates.map(templateWeightLookup);

  let bestScore = -Infinity;
  let secondScore = -Infinity;
  let bestRoot = 0;
  let bestQuality: ChordQuality = templates[0].quality;

  for (let root = 0; root < 12; root++) {
    for (let t = 0; t < templates.length; t++) {
      const lookup = lookups[t];
      let onChord = 0;
      for (let i = 0; i < 12; i++) {
        if (pc[i] === 0) {
          continue;
        }
        const w = lookup.get((((i - root) % 12) + 12) % 12);
        if (w !== undefined) {
          onChord += pc[i] * w;
        }
      }
      let chordMass = 0;
      for (const [offset] of templates[t].tones) {
        chordMass += pc[(((root + offset) % 12) + 12) % 12];
      }
      const score = onChord - OFF_CHORD_PENALTY * (1 - chordMass);
      if (score > bestScore) {
        secondScore = bestScore;
        bestScore = score;
        bestRoot = root;
        bestQuality = templates[t].quality;
      } else if (score > secondScore) {
        secondScore = score;
      }
    }
  }

  let confidence = 0;
  if (bestScore > 0 && secondScore > -Infinity) {
    confidence = Math.max(0, Math.min(1, (bestScore - secondScore) / bestScore));
  }
  return { rootPc: bestRoot, quality: bestQuality, confidence };
}
