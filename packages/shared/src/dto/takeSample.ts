/**
 * A take handed over so its reading can be checked against the sound.
 *
 * The pure part lives here — in a package with no filesystem, no network
 * and no React — because both ends need it and neither should own it: the
 * app builds a sample, the pull command reads one, and if they disagreed
 * about what a sample is, the disagreement would only show up as a corpus
 * that could not be opened.
 *
 * Spec: .harnex/project/specs/domains/dogfood/entities-samples.yml
 */
import type { InterpretationDto } from './interpretation';
import type { HitDto, NoteEventDto } from './note';

/** The collection samples land in. One name, so both ends use the same. */
export const TAKE_SAMPLES_COLLECTION = 'take_samples';

/** Where a sample sits. */
export type SampleState = 'pending_share' | 'shared' | 'pulled';

/**
 * What the app heard, frozen at the moment of sharing.
 *
 * Frozen is the whole point. A note is re-read every time a detector is
 * tuned, so a sample that read the note's current melody would repair
 * itself the moment the mistake it recorded was papered over — and the
 * evidence would be gone exactly when it was needed (INV-DOG-032).
 */
export interface TakeReadingDto {
  /** What the detector heard, before anyone touched it. */
  melody: NoteEventDto[];
  /**
   * The melody with the corrections a person made by hand replayed onto
   * it, when there are any.
   *
   * This is the most valuable thing in a sample and the cheapest to
   * collect. Every other field says what the app decided; this says what
   * the only person who was there says it should have been. The
   * difference between the two is the mistake, stated rather than
   * inferred — and a detector can be scored against it without anyone
   * listening to anything.
   */
  corrected?: NoteEventDto[];
  /**
   * Everything the person did to the take: the beat they tapped, the bar
   * lines they placed, the tempo they set by hand, the chords they chose.
   *
   * Carried for the same reason `corrected` is. These are not readings —
   * they are statements of intent, and a tapped beat says what the tempo
   * detector should have found as plainly as a corrected note says what
   * the pitch detector should have heard. The first sample shared carried
   * none of them, so it could show that the tempo had been missed and
   * never what the tempo was.
   */
  interpretations: InterpretationDto[];
  hits: HitDto[];
  /** Absent means the oldest reading, as a take stored before numbering. */
  analysisVersion?: number;
  key: string | null;
  tempoBpm: number | null;
  inTuneRatio: number | null;
  meanCentsError: number | null;
  noteCount: number;
  rangeLowMidi: number | null;
  rangeHighMidi: number | null;
}

/** As much of a note as a reading needs. Structural, so any shape fits. */
export interface ReadableTake {
  melody: NoteEventDto[];
  hits?: HitDto[];
  interpretations?: InterpretationDto[];
  analysisVersion?: number;
  key?: string | null;
  tempoBpm?: number | null;
  inTuneRatio?: number | null;
  meanCentsError?: number | null;
  noteCount: number;
  rangeLowMidi?: number | null;
  rangeHighMidi?: number | null;
}

/**
 * Copy out what the app made of a take.
 *
 * Every optional field is written explicitly as null rather than left off:
 * a corpus is read by something that has to tell "the app found no key"
 * from "this sample predates keys", and an absent field cannot say which.
 */
export function readingOf(
  take: ReadableTake,
  corrected?: NoteEventDto[]
): TakeReadingDto {
  // Only when it says something. A corrected melody identical to the heard
  // one is not a correction, and storing it as one would read as a person
  // having confirmed the take note by note when they did nothing at all.
  const differs =
    corrected != null && JSON.stringify(corrected) !== JSON.stringify(take.melody);
  return {
    melody: take.melody,
    corrected: differs ? corrected : undefined,
    interpretations: take.interpretations ?? [],
    hits: take.hits ?? [],
    analysisVersion: take.analysisVersion,
    key: take.key ?? null,
    tempoBpm: take.tempoBpm ?? null,
    inTuneRatio: take.inTuneRatio ?? null,
    meanCentsError: take.meanCentsError ?? null,
    noteCount: take.noteCount,
    rangeLowMidi: take.rangeLowMidi ?? null,
    rangeHighMidi: take.rangeHighMidi ?? null
  };
}

/**
 * A short, stable stand-in for a reading, so two of them can be told
 * apart without keeping either.
 *
 * What it is used for is one question: has this take been read again
 * since it was last shared? That decides whether sharing it once more
 * would add evidence or just upload the same minutes of audio to say the
 * same thing (INV-DOG-034).
 *
 * FNV-1a over the reading's JSON. Not a security hash and not trying to
 * be — a collision here costs one share that should have happened, which
 * the next re-read offers again.
 */
export function readingFingerprint(reading: TakeReadingDto): string {
  const json = JSON.stringify([
    reading.melody,
    reading.corrected ?? null,
    reading.interpretations,
    reading.hits,
    reading.analysisVersion ?? null
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    // The FNV prime, by shifts, so this stays in 32 bits without BigInt.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return `${hash.toString(16)}-${json.length.toString(16)}`;
}

/** One shared take, as either end sees it. */
export interface TakeSampleDto {
  id: string;
  noteId: string;
  title: string;
  audioPath: string | null;
  durationMs: number;
  sampleRateHz: number;
  reading: TakeReadingDto;
  appVersion: string;
  buildNumber: number;
  bundleId: string | null;
  sharedAtMs: number;
  state: SampleState;
}

/** Longest a title may run in a directory name. Long enough to recognise. */
const SLUG_CAP = 40;

/** A title reduced to something a filesystem and a human both accept. */
export function slugOfTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_CAP)
    .replace(/-+$/, '');
  // A take named only in punctuation, or not named at all. The id that
  // follows still makes the directory unique; this only has to be legible.
  return slug.length > 0 ? slug : 'take';
}

/**
 * What a sample's directory in the corpus is called.
 *
 * Date first so a listing sorts by when it was sung, title next so it can
 * be recognised, id last so two takes with one name cannot collide. The id
 * is also what a pull needs to find the directory again, which is why it
 * is in the name rather than only in a file inside it.
 */
export function sampleDirName(sample: {
  id: string;
  title: string;
  sharedAtMs: number;
}): string {
  const day = new Date(sample.sharedAtMs).toISOString().slice(0, 10);
  return `${day}-${slugOfTitle(sample.title)}-${sample.id}`;
}
