/**
 * Every number the melody reading turns on, adjustable (INV-NOTES-172).
 *
 * Tuning a detector is a loop: change a number, listen, change it again. So
 * every threshold the reading depends on is here, in one table, with the
 * range it is meaningful over and a sentence saying what moving it does — and
 * the panel that draws them sits on the note being listened to, next to the
 * control that reads it again.
 *
 * Every number, because the one that matters is never the one you expected.
 * Half the surface exposed is a search with half its dimensions missing, and
 * the missing one is where the fault turns out to live.
 *
 * A group is which argument of `readTake` the knob belongs to, so the reading
 * is assembled from this table rather than from a second list somewhere else.
 *
 * Declared grouped by what they belong to. The order they are SHOWN in is a
 * separate judgement about how the person tuning actually sings, and lives in
 * `knobOrder`.
 */
import type { SegmentKnob } from './segmentSettings';
import { SEGMENT_KNOBS } from './segmentSettings';

/** Which part of the reading a knob belongs to. */
export type KnobGroup = 'smooth' | 'segment' | 'bends' | 'percussion' | 'top';

export interface ReadingKnob extends SegmentKnob {
  group: KnobGroup;
  /** What it is called where somebody is choosing. */
  title: string;
  /** What moving it does, in the words somebody tuning would use. */
  hint: string;
}

/** Titles and hints for the segmentation knobs, which predate this table. */
const SEGMENT_WORDS: Record<string, { title: string; hint: string }> = {
  vibratoSemitones: {
    title: 'Vibrato pitch variation allowed',
    hint: 'How far the pitch may wander and still be one note. Raise it if a whistle scooping into a note is split into several.'
  },
  pitchHoldMs: {
    title: 'Considered a new note after',
    hint: 'How long a new pitch must hold before it counts as its own note. The main one for whistling: raise it if a scoop reads as extra notes.'
  },
  maxGapMs: {
    title: 'Note continues through a dropout of up to',
    hint: 'How long the detector may lose the pitch without ending the note. Raise it if single notes break in two.'
  },
  articulationDropDb: {
    title: 'Note ends when the level drops by',
    hint: 'How far the level must fall during a dropout for it to be a real stop. Rarely fires on a legato whistle; lower it if tongued notes read as one.'
  },
  aspirationRiseDb: {
    title: 'New note when the level rises by',
    hint: 'How far the level must climb for a note pushed again on the breath. A whistle does not do this, so it will seldom matter to a whistled take.'
  },
  onsetWindowMs: {
    title: 'That rise counted within',
    hint: 'How quickly that climb must happen to be a re-attack rather than a swell. Only bites where the rise above does.'
  },
  minDurationMs: {
    title: 'Discarded when shorter than',
    hint: 'The shortest run of pitch kept as a note at all. Raise it to drop the specks a scoop leaves behind.'
  }
};

export const DECLARED_KNOBS: readonly ReadingKnob[] = [
  {
    group: 'smooth',
    key: 'windowSize',
    title: 'Pitch smoothed across frames',
    hint: 'How many frames are averaged together before anything is read. Raise it for a steadier trace, lower it to keep fast movement.',
    fallback: 5,
    min: 1,
    max: 15,
    step: 2
  },
  {
    group: 'smooth',
    key: 'minClarity',
    title: 'Ignored below this clarity',
    hint: 'Frames less periodic than this are treated as unvoiced before anything is read. Raise it in a noisy room.',
    fallback: 0,
    min: 0,
    max: 0.9,
    step: 0.05,
    decimals: 2
  },
  ...SEGMENT_KNOBS.map((knob) => ({
    ...knob,
    group: 'segment' as const,
    title: SEGMENT_WORDS[knob.key]?.title ?? knob.key,
    hint: SEGMENT_WORDS[knob.key]?.hint ?? ''
  })),
  {
    group: 'bends',
    key: 'maxJoinGapMs',
    title: 'Joined across a silence of up to',
    hint: 'The widest silence two notes may be separated by and still be read as one note bending between them.',
    fallback: 40,
    min: 0,
    max: 200,
    step: 10,
    unit: 'ms'
  },
  {
    group: 'bends',
    key: 'minMoveSemitones',
    title: 'Counted as a bend above',
    hint: 'How far the pitch must actually move for the join to be a bend. Below this the two are simply the same note.',
    fallback: 0.1,
    min: 0.02,
    max: 1,
    step: 0.02,
    decimals: 2
  },
  {
    group: 'top',
    key: 'minArticulationMs',
    title: 'Too brief to have been intended',
    hint: 'Anything shorter is dropped as a detector artefact rather than something anybody meant to make.',
    fallback: 70,
    min: 10,
    max: 250,
    step: 10,
    unit: 'ms'
  },
  {
    group: 'percussion',
    key: 'minLevelDb',
    title: 'Hit must be louder than',
    hint: 'How far above silence a struck sound must be. Raise it if breath noise reads as drums.',
    fallback: -45,
    min: -70,
    max: -20,
    step: 1,
    unit: 'dB'
  },
  {
    group: 'percussion',
    key: 'maxDurationMs',
    title: 'Hit must be shorter than',
    hint: 'Longer than this and it is a note being sung badly rather than something struck.',
    fallback: 140,
    min: 40,
    max: 400,
    step: 10,
    unit: 'ms'
  },
  {
    group: 'percussion',
    key: 'maxClarity',
    title: 'Hit must be less pitched than',
    hint: 'How periodic a sound may be and still be struck rather than sung. Lower it if hummed notes read as drums.',
    fallback: 0.5,
    min: 0.1,
    max: 0.95,
    step: 0.05,
    decimals: 2
  },
  {
    group: 'percussion',
    key: 'minFlatness',
    title: 'Hit must be noisier than',
    hint: 'How flat the spectrum must be — how little tone is in it — whatever the periodicity said.',
    fallback: 0.25,
    min: 0.05,
    max: 0.9,
    step: 0.05,
    decimals: 2
  }
];
