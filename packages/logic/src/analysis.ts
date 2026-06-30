/**
 * Corpus analysis — mine a user's library of sung "notes" for the melodic and
 * harmonic habits they can actually hear.
 *
 * A *note* (the app's memo, not a pitch) is captured as a {@link NoteEvent}[]
 * (the symbolic melody). The *corpus* is the array of those melodies. The heavy
 * DSP already ran at capture; everything here is cheap symbolic math over the
 * persisted `melody_json`, so the whole corpus can be re-aggregated on-device
 * whenever a note is added or removed.
 *
 * Design priorities (in order):
 *   1. **Perceptual honesty** — results must correspond to what a singer hears.
 *      Intervals are not counted across a breath/rest; interval classes fold by
 *      octave but keep their quality (a m2 is never merged with a M7); chord
 *      functions aggregate key-relative so memos in different keys combine by the
 *      role the ear assigns them (a V→I is a V→I in any key).
 *   2. **Performance** — every function is O(total notes) with tiny constants and
 *      uses no `**`/`Math.log2` (ES5-safe, worklet/server-portable like the rest
 *      of `logic`).
 *
 * Pure and dependency-free beyond sibling `logic` primitives.
 */
import type { NoteEvent } from './segmentation';
import { detectKey, type KeyEstimate } from './key';
import { NOTE_NAMES } from './notes';
import type { TargetNote } from './scoring';

/** A single sung melody — the symbolic content of one note/memo. */
export type Melody = readonly NoteEvent[];
/** The user's whole library of melodies. */
export type Corpus = readonly Melody[];

// ---------------------------------------------------------------------------
// Interval naming
// ---------------------------------------------------------------------------

/**
 * Names for an octave-folded interval, indexed 0..12. Folding keeps the octave
 * (12) distinct from the unison (0) because an octave leap and a repeated note
 * sound nothing alike; compound intervals reduce into 1..12 (a M9 reads as M2),
 * which is how the ear hears their melodic colour.
 */
const INTERVAL_CLASS_NAMES = [
  'P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'
] as const;

/** Fold a signed semitone distance to an interval class in 0..12 (octave kept). */
export function intervalClass(semitones: number): number {
  const a = Math.abs(semitones);
  if (a === 0) {
    return 0;
  }
  return ((a - 1) % 12) + 1;
}

/** Name of a folded interval class, e.g. 4 -> 'M3'. */
export function intervalClassName(ic: number): string {
  return INTERVAL_CLASS_NAMES[ic] ?? `${ic}st`;
}

/** Directional name of a signed interval, e.g. +4 -> '+M3', -7 -> '-P5', 0 -> 'P1'. */
export function intervalName(semitones: number): string {
  const ic = intervalClass(semitones);
  const base = intervalClassName(ic);
  if (semitones === 0) {
    return base;
  }
  return (semitones > 0 ? '+' : '-') + base;
}

// ---------------------------------------------------------------------------
// Phrases & intervals
// ---------------------------------------------------------------------------

export interface PhraseOptions {
  /**
   * A rest longer than this (gap between one note's end and the next note's
   * start) breaks the melodic line into a new phrase. Intervals are never
   * counted across such a gap — you don't *hear* an interval over a breath.
   * Default 600ms.
   */
  maxRestMs?: number;
}

/**
 * Split a melody into phrases — maximal runs of notes with no long rest between
 * them. The unit over which consecutive intervals are perceived.
 */
export function melodyToPhrases(
  notes: Melody,
  options: PhraseOptions = {}
): NoteEvent[][] {
  const maxRest = options.maxRestMs ?? 600;
  const phrases: NoteEvent[][] = [];
  let current: NoteEvent[] = [];
  let prev: NoteEvent | null = null;

  for (const note of notes) {
    if (prev != null && note.startMs - prev.endMs > maxRest) {
      if (current.length > 0) {
        phrases.push(current);
      }
      current = [];
    }
    current.push(note);
    prev = note;
  }
  if (current.length > 0) {
    phrases.push(current);
  }
  return phrases;
}

/**
 * Consecutive signed semitone deltas of a melody (transposition-invariant).
 * Intervals that would span a phrase break (a rest) are omitted, so the result
 * only contains steps the singer actually heard as adjacent.
 */
export function melodyToIntervals(
  notes: Melody,
  options: PhraseOptions = {}
): number[] {
  const intervals: number[] = [];
  for (const phrase of melodyToPhrases(notes, options)) {
    for (let i = 1; i < phrase.length; i++) {
      intervals.push(phrase[i].midi - phrase[i - 1].midi);
    }
  }
  return intervals;
}

/** Per-melody interval arrays for a corpus (convenience for {@link intervalHistogram}). */
export function corpusIntervals(
  corpus: Corpus,
  options: PhraseOptions = {}
): number[][] {
  return corpus.map((m) => melodyToIntervals(m, options));
}

// ---------------------------------------------------------------------------
// Interval histogram
// ---------------------------------------------------------------------------

export interface IntervalCount {
  /** Signed semitones (direction preserved). */
  semitones: number;
  /** Directional name, e.g. '+M3'. */
  name: string;
  count: number;
  /** Share of all counted intervals, 0..1. */
  ratio: number;
}

export interface IntervalClassCount {
  /** Octave-folded class, 0..12. */
  ic: number;
  /** Class name, e.g. 'M3'. */
  name: string;
  /** Count folded over direction and octave. */
  count: number;
  ratio: number;
}

export interface IntervalHistogram {
  /** Total intervals counted across the corpus. */
  total: number;
  /** Directional counts (up/down kept separate), most-frequent first. */
  directional: IntervalCount[];
  /** Octave/direction-folded class counts, most-frequent first. */
  byClass: IntervalClassCount[];
}

/**
 * Histogram of the intervals a singer uses, both directionally and folded to
 * interval classes. Takes the per-melody interval arrays (see
 * {@link corpusIntervals}); a histogram doesn't care about phrase boundaries,
 * so the flat arrays are sufficient and the call stays composable.
 */
export function intervalHistogram(corpus: readonly number[][]): IntervalHistogram {
  const bySemitone = new Map<number, number>();
  const byClassCount = new Map<number, number>();
  let total = 0;

  for (const intervals of corpus) {
    for (const semis of intervals) {
      bySemitone.set(semis, (bySemitone.get(semis) ?? 0) + 1);
      const ic = intervalClass(semis);
      byClassCount.set(ic, (byClassCount.get(ic) ?? 0) + 1);
      total++;
    }
  }

  const norm = total > 0 ? total : 1;

  const directional: IntervalCount[] = Array.from(bySemitone.entries())
    .map(([semitones, count]) => ({
      semitones,
      name: intervalName(semitones),
      count,
      ratio: count / norm
    }))
    .sort((a, b) => b.count - a.count || a.semitones - b.semitones);

  const byClass: IntervalClassCount[] = Array.from(byClassCount.entries())
    .map(([ic, count]) => ({
      ic,
      name: intervalClassName(ic),
      count,
      ratio: count / norm
    }))
    .sort((a, b) => b.count - a.count || a.ic - b.ic);

  return { total, directional, byClass };
}

// ---------------------------------------------------------------------------
// Frequent fragments (interval n-grams)
// ---------------------------------------------------------------------------

export interface Fragment {
  /** The interval sequence (signed semitone deltas) that defines the shape. */
  intervals: number[];
  /** Number of notes in the fragment (= intervals.length + 1). */
  noteCount: number;
  /** Times this exact shape recurs across the corpus. */
  count: number;
  /** count * (noteCount - 1) — frequency weighted by motif length. */
  salience: number;
  /** An actual sung realization (absolute MIDI), so the fragment is playable. */
  exampleMidi: number[];
}

export interface FragmentOptions extends PhraseOptions {
  /** Inclusive fragment lengths in *notes* (default [3, 5]). */
  nRange?: [number, number];
  /** Minimum recurrences to report (default 2 — a "fragment" must recur). */
  minCount?: number;
  /** Cap on returned fragments (default 12). */
  top?: number;
}

/**
 * The melodic shapes a singer reaches for most — the top recurring interval
 * n-grams across the corpus, transposition-invariant. Each is paired with a
 * real pitch realization (the first time it was sung) so the UI can play back
 * exactly what the habit sounds like.
 *
 * n-grams are taken within phrases only (never across a rest), so a reported
 * fragment is always a contour the singer actually performed as one gesture.
 */
export function frequentFragments(
  corpus: Corpus,
  options: FragmentOptions = {}
): Fragment[] {
  const [minNotes, maxNotes] = options.nRange ?? [3, 5];
  const minCount = options.minCount ?? 2;
  const top = options.top ?? 12;

  // key -> { count, exampleMidi }. Key is the interval shape; the example is the
  // first absolute realization seen, kept for playback.
  const table = new Map<string, { intervals: number[]; count: number; example: number[] }>();

  for (const melody of corpus) {
    for (const phrase of melodyToPhrases(melody, options)) {
      const midis = phrase.map((n) => n.midi);
      // Fragment length in notes; need at least `n` notes in this phrase.
      for (let n = minNotes; n <= maxNotes; n++) {
        if (phrase.length < n) {
          continue;
        }
        for (let start = 0; start + n <= phrase.length; start++) {
          const shape: number[] = [];
          for (let k = 1; k < n; k++) {
            shape.push(midis[start + k] - midis[start + k - 1]);
          }
          const key = `${n}:${shape.join(',')}`;
          const entry = table.get(key);
          if (entry) {
            entry.count++;
          } else {
            table.set(key, {
              intervals: shape,
              count: 1,
              example: midis.slice(start, start + n)
            });
          }
        }
      }
    }
  }

  const fragments: Fragment[] = [];
  for (const entry of table.values()) {
    if (entry.count < minCount) {
      continue;
    }
    fragments.push({
      intervals: entry.intervals,
      noteCount: entry.intervals.length + 1,
      count: entry.count,
      salience: entry.count * entry.intervals.length,
      exampleMidi: entry.example
    });
  }

  fragments.sort(
    (a, b) =>
      b.count - a.count ||
      b.noteCount - a.noteCount ||
      b.salience - a.salience
  );
  return fragments.slice(0, top);
}

// ---------------------------------------------------------------------------
// Implied harmony (per-melody)
// ---------------------------------------------------------------------------

export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dim'
  | 'aug'
  | 'maj7'
  | 'dom7'
  | 'min7'
  | 'm7b5'
  | 'dim7';

/** Weighted pitch-class templates (offset from root -> perceptual weight). */
interface ChordTemplate {
  quality: ChordQuality;
  /** [offsetSemitones, weight] chord tones; root is weighted highest. */
  tones: ReadonlyArray<readonly [number, number]>;
}

const TRIAD_TEMPLATES: readonly ChordTemplate[] = [
  { quality: 'maj', tones: [[0, 3], [4, 2], [7, 2]] },
  { quality: 'min', tones: [[0, 3], [3, 2], [7, 2]] },
  { quality: 'dim', tones: [[0, 3], [3, 2], [6, 2]] },
  { quality: 'aug', tones: [[0, 3], [4, 2], [8, 2]] }
];

const SEVENTH_TEMPLATES: readonly ChordTemplate[] = [
  { quality: 'maj7', tones: [[0, 3], [4, 2], [7, 1.5], [11, 1.5]] },
  { quality: 'dom7', tones: [[0, 3], [4, 2], [7, 1.5], [10, 1.5]] },
  { quality: 'min7', tones: [[0, 3], [3, 2], [7, 1.5], [10, 1.5]] },
  { quality: 'm7b5', tones: [[0, 3], [3, 2], [6, 1.5], [10, 1.5]] },
  { quality: 'dim7', tones: [[0, 3], [3, 2], [6, 1.5], [9, 1.5]] }
];

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  maj7: 'maj7',
  dom7: '7',
  min7: 'm7',
  m7b5: 'm7b5',
  dim7: 'dim7'
};

export interface ChordEstimate {
  startMs: number;
  endMs: number;
  /** Chord root pitch class, 0..11. */
  rootPc: number;
  quality: ChordQuality;
  /** Human label — absolute (e.g. 'Cmaj7') or roman (e.g. 'V7') when key-relative. */
  label: string;
  /** 0..1 relative margin over the runner-up chord. */
  confidence: number;
}

/**
 * The user-tunable knobs for chord inference (surfaced in Account & Settings).
 * Kept as one named shape so the UI, the persisted settings, and the analysis
 * all agree on the same defaults — a single source of truth.
 */
export interface ChordInferenceSettings {
  /** Analysis window in ms. */
  windowMs: number;
  /** Chord set to match against. */
  vocabulary: 'triads' | 'sevenths';
  /** Label chords as roman numerals relative to the detected key. */
  keyRelative: boolean;
  /** Drop windows whose confidence is below this. */
  minConfidence: number;
}

/**
 * Default chord-inference settings for the UI/Dashboard. `keyRelative` is true
 * here (unlike {@link impliedHarmony}'s bare default) because the corpus
 * aggregation it feeds only combines memos written in different keys sensibly
 * when chords are expressed by function (roman numerals).
 */
export const DEFAULT_CHORD_INFERENCE: ChordInferenceSettings = {
  windowMs: 2000,
  vocabulary: 'triads',
  keyRelative: true,
  minConfidence: 0
};

export interface ImpliedHarmonyOptions {
  /** Analysis window in ms (default {@link DEFAULT_CHORD_INFERENCE}.windowMs). */
  windowMs?: number;
  /** Hop between windows in ms (default = windowMs, i.e. non-overlapping). */
  hopMs?: number;
  /** Chord set to match against (default 'triads'). */
  vocabulary?: 'triads' | 'sevenths';
  /** Label chords as roman numerals relative to the detected key (default false). */
  keyRelative?: boolean;
  /** Drop windows whose confidence is below this (default 0). */
  minConfidence?: number;
  /** Precomputed key (for roman labels); detected from the melody when omitted. */
  key?: KeyEstimate;
}

/** Weight a chord tone carries when matching, by its template offset. */
function templateWeightLookup(template: ChordTemplate): Map<number, number> {
  const map = new Map<number, number>();
  for (const [offset, weight] of template.tones) {
    map.set(((offset % 12) + 12) % 12, weight);
  }
  return map;
}

/** Off-chord weight penalty — chords that leave a lot of sung weight unexplained lose. */
const OFF_CHORD_PENALTY = 0.5;

/**
 * Estimate the harmony a monophonic melody implies, window by window. A sung
 * line has no chords, but the pitch-classes it dwells on over a span imply one:
 * we build a duration-weighted pitch-class histogram per window and score it
 * against weighted chord templates at all 12 roots, picking the best fit. This
 * is the same family of template-matching as {@link detectKey}, scoped to a
 * window and a chord vocabulary.
 */
export function impliedHarmony(
  notes: Melody,
  options: ImpliedHarmonyOptions = {}
): ChordEstimate[] {
  if (notes.length === 0) {
    return [];
  }
  // Bare defaults here are intentionally absolute (keyRelative false); the
  // UI-facing DEFAULT_CHORD_INFERENCE differs (key-relative) for corpus use.
  const windowMs = options.windowMs ?? 2000;
  const hopMs = options.hopMs ?? windowMs;
  const vocabulary = options.vocabulary ?? 'triads';
  const keyRelative = options.keyRelative ?? false;
  const minConfidence = options.minConfidence ?? 0;
  const templates =
    vocabulary === 'sevenths' ? SEVENTH_TEMPLATES : TRIAD_TEMPLATES;
  const lookups = templates.map(templateWeightLookup);
  const key = options.key ?? (keyRelative ? detectKey(notes) : undefined);

  let endOfMelody = 0;
  for (const n of notes) {
    if (n.endMs > endOfMelody) {
      endOfMelody = n.endMs;
    }
  }

  const out: ChordEstimate[] = [];

  for (let winStart = 0; winStart < endOfMelody; winStart += hopMs) {
    const winEnd = winStart + windowMs;

    // Duration-weighted pitch-class histogram for notes overlapping the window.
    const pc = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let weightTotal = 0;
    for (const n of notes) {
      const overlap = Math.min(n.endMs, winEnd) - Math.max(n.startMs, winStart);
      if (overlap <= 0) {
        continue;
      }
      const cls = ((Math.round(n.midi) % 12) + 12) % 12;
      pc[cls] += overlap;
      weightTotal += overlap;
    }
    if (weightTotal === 0) {
      continue;
    }
    for (let i = 0; i < 12; i++) {
      pc[i] /= weightTotal; // normalize so scores are window-size-invariant
    }

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
          const offset = ((i - root) % 12 + 12) % 12;
          const w = lookup.get(offset);
          if (w !== undefined) {
            onChord += pc[i] * w;
          }
        }
        // pc sums to 1; offChord weight = 1 - (weight on chord tones as plain mass).
        let chordMass = 0;
        for (const [offset] of templates[t].tones) {
          chordMass += pc[((root + offset) % 12 + 12) % 12];
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
      confidence = (bestScore - secondScore) / bestScore;
      if (confidence < 0) confidence = 0;
      else if (confidence > 1) confidence = 1;
    }
    if (confidence < minConfidence) {
      continue;
    }

    out.push({
      startMs: winStart,
      endMs: Math.min(winEnd, endOfMelody),
      rootPc: bestRoot,
      quality: bestQuality,
      label: keyRelative && key
        ? romanLabel(bestRoot, bestQuality, key)
        : absoluteLabel(bestRoot, bestQuality),
      confidence
    });
  }

  return out;
}

/** Absolute chord label, e.g. (root 0, 'maj7') -> 'Cmaj7'. */
export function absoluteLabel(rootPc: number, quality: ChordQuality): string {
  return NOTE_NAMES[((rootPc % 12) + 12) % 12] + QUALITY_SUFFIX[quality];
}

const ROMAN_BASE = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];

/** Roman-numeral label relative to a key, e.g. dominant seventh on degree 7 -> 'V7'. */
export function romanLabel(
  rootPc: number,
  quality: ChordQuality,
  key: KeyEstimate
): string {
  const degree = ((rootPc - key.tonic) % 12 + 12) % 12;
  let roman = ROMAN_BASE[degree];
  const minorish =
    quality === 'min' ||
    quality === 'dim' ||
    quality === 'min7' ||
    quality === 'm7b5' ||
    quality === 'dim7';
  if (minorish) {
    roman = roman.toLowerCase();
  }
  let suffix = '';
  switch (quality) {
    case 'dim':
      suffix = '°';
      break;
    case 'aug':
      suffix = '+';
      break;
    case 'maj7':
      suffix = 'maj7';
      break;
    case 'dom7':
      suffix = '7';
      break;
    case 'min7':
      suffix = '7';
      break;
    case 'm7b5':
      suffix = 'ø7';
      break;
    case 'dim7':
      suffix = '°7';
      break;
    default:
      suffix = '';
  }
  return roman + suffix;
}

// ---------------------------------------------------------------------------
// Chord reflection (corpus)
// ---------------------------------------------------------------------------

export interface ChordCount {
  /** Key-relative roman label (or absolute when keyRelative is false). */
  label: string;
  count: number;
  ratio: number;
}

export interface ChordChange {
  /** Transition label, e.g. 'V→I'. */
  label: string;
  count: number;
  ratio: number;
}

export interface ChordReflection {
  /** Most-reflected chords across the corpus, most-frequent first. */
  chords: ChordCount[];
  /** Most-reflected chord *changes* (transitions), most-frequent first. */
  changes: ChordChange[];
}

export interface ChordReflectionOptions extends ImpliedHarmonyOptions {
  /** Cap on returned chords/changes each (default 12). */
  top?: number;
}

/**
 * Which chords and chord *changes* a singer's melodies most reflect, aggregated
 * across the corpus. Defaults to key-relative (roman) labels so memos written
 * in different keys combine by harmonic *function* — a V→I in any key counts as
 * the same change, which is how the ear relates them. Consecutive identical
 * chords are collapsed before counting transitions, so a sustained harmony is
 * one chord, not a string of false repeats.
 */
export function chordReflection(
  corpus: Corpus,
  options: ChordReflectionOptions = {}
): ChordReflection {
  const top = options.top ?? 12;
  // Aggregate key-relative by default — only way cross-key memos combine sensibly.
  const opts: ImpliedHarmonyOptions = {
    ...options,
    keyRelative: options.keyRelative ?? true
  };

  const chordCounts = new Map<string, number>();
  const changeCounts = new Map<string, number>();
  let chordTotal = 0;
  let changeTotal = 0;

  for (const melody of corpus) {
    const estimates = impliedHarmony(melody, opts);
    // Collapse consecutive identical chords into a progression.
    const progression: string[] = [];
    for (const est of estimates) {
      if (progression.length === 0 || progression[progression.length - 1] !== est.label) {
        progression.push(est.label);
      }
    }
    for (const label of progression) {
      chordCounts.set(label, (chordCounts.get(label) ?? 0) + 1);
      chordTotal++;
    }
    for (let i = 1; i < progression.length; i++) {
      const change = `${progression[i - 1]}→${progression[i]}`;
      changeCounts.set(change, (changeCounts.get(change) ?? 0) + 1);
      changeTotal++;
    }
  }

  const chordNorm = chordTotal > 0 ? chordTotal : 1;
  const changeNorm = changeTotal > 0 ? changeTotal : 1;

  const chords: ChordCount[] = Array.from(chordCounts.entries())
    .map(([label, count]) => ({ label, count, ratio: count / chordNorm }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, top);

  const changes: ChordChange[] = Array.from(changeCounts.entries())
    .map(([label, count]) => ({ label, count, ratio: count / changeNorm }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, top);

  return { chords, changes };
}

// ---------------------------------------------------------------------------
// Avoidance profile (corpus)
// ---------------------------------------------------------------------------

export interface AvoidedPattern {
  /** Interval class, 0..12. */
  ic: number;
  /** Class name, e.g. 'TT'. */
  name: string;
  /** Share of the singer's intervals that are this class, 0..1. */
  presence: number;
  /** Euclidean distance of this pattern from the singer's common-pattern centroid. */
  distance: number;
}

export interface AvoidanceOptions extends PhraseOptions {
  /** Include the unison/repeated-note class (default false — not a melodic interval). */
  includeUnison?: boolean;
  /** Cap on returned patterns (default all present classes). */
  top?: number;
}

/**
 * The intervals a singer most *avoids* — the patterns harmonically furthest from
 * the centroid of what they habitually sing. The centroid is the singer's
 * normalized interval-class distribution; each candidate interval class is a
 * one-hot vector, and its distance from that centroid is largest exactly for the
 * classes the singer uses least. Ranking by distance therefore surfaces genuine
 * avoidance (rarely-sung colours), not merely the long tail of a single melody.
 *
 * Returns every interval class (so a class never sung still appears, with the
 * largest distance), most-avoided first.
 */
export function avoidanceProfile(
  corpus: Corpus,
  options: AvoidanceOptions = {}
): AvoidedPattern[] {
  const includeUnison = options.includeUnison ?? false;
  const phraseOpts: PhraseOptions = { maxRestMs: options.maxRestMs };

  // Centroid = normalized interval-class distribution over the whole corpus.
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // ic 0..12
  let total = 0;
  for (const melody of corpus) {
    for (const semis of melodyToIntervals(melody, phraseOpts)) {
      counts[intervalClass(semis)]++;
      total++;
    }
  }
  const norm = total > 0 ? total : 1;
  const centroid = counts.map((c) => c / norm);

  const firstIc = includeUnison ? 0 : 1;
  const patterns: AvoidedPattern[] = [];
  for (let ic = firstIc; ic <= 12; ic++) {
    // Distance from the one-hot vector for `ic` to the centroid.
    let sumSq = 0;
    for (let j = firstIc; j <= 12; j++) {
      const target = j === ic ? 1 : 0;
      const diff = target - centroid[j];
      sumSq += diff * diff;
    }
    patterns.push({
      ic,
      name: intervalClassName(ic),
      presence: centroid[ic],
      distance: Math.sqrt(sumSq)
    });
  }

  patterns.sort((a, b) => b.distance - a.distance || a.ic - b.ic);
  return options.top != null ? patterns.slice(0, options.top) : patterns;
}

// ---------------------------------------------------------------------------
// Whole-corpus aggregate (what the Dashboard renders / the cache stores)
// ---------------------------------------------------------------------------

export interface CorpusAnalysis {
  melodyCount: number;
  noteCount: number;
  intervals: IntervalHistogram;
  fragments: Fragment[];
  chords: ChordReflection;
  avoided: AvoidedPattern[];
}

export interface CorpusAnalysisOptions
  extends FragmentOptions,
    ChordReflectionOptions,
    AvoidanceOptions {}

/**
 * Run every corpus insight in one pass-friendly call. This is the aggregate the
 * data layer caches (MMKV) and the Dashboard reads; cheap enough to recompute
 * whenever the notes corpus changes.
 */
export function analyzeCorpus(
  corpus: Corpus,
  options: CorpusAnalysisOptions = {}
): CorpusAnalysis {
  let noteCount = 0;
  for (const m of corpus) {
    noteCount += m.length;
  }
  return {
    melodyCount: corpus.length,
    noteCount,
    intervals: intervalHistogram(corpusIntervals(corpus, options)),
    fragments: frequentFragments(corpus, options),
    chords: chordReflection(corpus, options),
    avoided: avoidanceProfile(corpus, options)
  };
}

// ---------------------------------------------------------------------------
// Playback helpers
// ---------------------------------------------------------------------------

/** Tile an absolute MIDI sequence into back-to-back {@link TargetNote}s for playback. */
export function midiSequenceToTargets(
  midi: readonly number[],
  noteDurationMs = 400
): TargetNote[] {
  return midi.map((m, i) => ({
    midi: m,
    startMs: i * noteDurationMs,
    endMs: (i + 1) * noteDurationMs
  }));
}

/** Realize an interval shape from a root MIDI into playable {@link TargetNote}s. */
export function fragmentToTargets(
  rootMidi: number,
  intervals: readonly number[],
  noteDurationMs = 400
): TargetNote[] {
  const midi: number[] = [rootMidi];
  let current = rootMidi;
  for (const step of intervals) {
    current += step;
    midi.push(current);
  }
  return midiSequenceToTargets(midi, noteDurationMs);
}
