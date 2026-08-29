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

/** What each group is called, in the order a person would meet them. */
export const KNOB_GROUPS: readonly { group: KnobGroup; title: string }[] = [
  { group: 'smooth', title: 'Before anything is read' },
  { group: 'segment', title: 'What counts as one note' },
  { group: 'bends', title: 'What joins two notes into one' },
  { group: 'top', title: 'What is too small to have been meant' },
  { group: 'percussion', title: 'What counts as a struck sound' }
];

/** Titles and hints for the segmentation knobs, which predate this table. */
const SEGMENT_WORDS: Record<string, { title: string; hint: string }> = {
  vibratoSemitones: {
    title: 'Wobble width',
    hint: 'How wide a wobble is still one note. Raise it if a vibrato is being split into several.'
  },
  pitchHoldMs: {
    title: 'Hold to be a new note',
    hint: 'How long a new pitch must hold before it counts. Raise it if passing notes are being caught.'
  },
  maxGapMs: {
    title: 'Gap it can survive',
    hint: 'How long the detector may lose the pitch mid-note. Raise it if single notes are breaking in two.'
  },
  articulationDropDb: {
    title: 'Drop that ends a note',
    hint: 'How far the level must fall in that gap to be a real stop. Lower it if fast "da da da" reads as one note.'
  },
  aspirationRiseDb: {
    title: 'Push that starts one',
    hint: 'How far the level must climb for a note pushed again on the breath. Lower it if "ha ha ha" reads as one note.'
  },
  onsetWindowMs: {
    title: 'How fast that push is',
    hint: 'How quickly that climb must happen to be a re-attack rather than a swell.'
  },
  minDurationMs: {
    title: 'Shortest note',
    hint: 'The shortest thing that can have been sung on purpose. Raise it to drop specks.'
  }
};

export const READING_KNOBS: readonly ReadingKnob[] = [
  {
    group: 'smooth',
    key: 'windowSize',
    title: 'Smoothing width',
    hint: 'How many frames are median-filtered together. Raise it for a steadier trace, lower it to keep fast movement.',
    fallback: 5,
    min: 1,
    max: 15,
    step: 2
  },
  {
    group: 'smooth',
    key: 'minClarity',
    title: 'Ignore below this clarity',
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
    title: 'Gap a bend may cross',
    hint: 'The widest silence two notes may be separated by and still be one note bending.',
    fallback: 40,
    min: 0,
    max: 200,
    step: 10,
    unit: 'ms'
  },
  {
    group: 'bends',
    key: 'minMoveSemitones',
    title: 'Least movement to be a bend',
    hint: 'Below this there is nothing being bent, and the two are simply the same note.',
    fallback: 0.1,
    min: 0.02,
    max: 1,
    step: 0.02,
    decimals: 2
  },
  {
    group: 'top',
    key: 'minArticulationMs',
    title: 'Too brief to have been sung',
    hint: 'Anything shorter is dropped as a detector artefact rather than a note.',
    fallback: 70,
    min: 10,
    max: 250,
    step: 10,
    unit: 'ms'
  },
  {
    group: 'percussion',
    key: 'minLevelDb',
    title: 'Loud enough to be a hit',
    hint: 'How far above silence a sound must be. Raise it if breath noise is reading as drums.',
    fallback: -45,
    min: -70,
    max: -20,
    step: 1,
    unit: 'dB'
  },
  {
    group: 'percussion',
    key: 'maxDurationMs',
    title: 'Longest a hit can be',
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
    title: 'Least pitched to be a hit',
    hint: 'More periodic than this and it is a pitch. Lower it if hummed notes read as drums.',
    fallback: 0.5,
    min: 0.1,
    max: 0.95,
    step: 0.05,
    decimals: 2
  },
  {
    group: 'percussion',
    key: 'minFlatness',
    title: 'Least noisy to be a hit',
    hint: 'Flatter spectrum means less tone in it, whatever the periodicity said.',
    fallback: 0.25,
    min: 0.05,
    max: 0.9,
    step: 0.05,
    decimals: 2
  }
];
