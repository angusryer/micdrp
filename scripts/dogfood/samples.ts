/**
 * Bringing shared takes down beside the code.
 *
 * This is the point of the whole feature. A remark says a reading was
 * wrong; a recording is the reading being wrong, and a detector can be run
 * against it. Everything the loop does with clips is about acting on
 * words — this does the opposite, and acts on nothing at all: it fetches
 * evidence and stops (INV-DOG-036).
 *
 * Spec: .harnex/project/specs/domains/dogfood/capabilities-samples.yml
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import PocketBase from 'pocketbase';

// By file rather than through the barrel, for the same reason clips.ts
// does it: Node's ESM loader needs explicit extensions and the barrel's
// imports are extensionless for Metro's benefit.
import {
  TAKE_SAMPLES_COLLECTION,
  sampleDirName
} from '../../packages/shared/src/dto/takeSample.ts';

/** One sample, as PocketBase serves it. */
export interface Sample {
  id: string;
  note_id: string;
  title: string;
  audio: string;
  duration_ms: number;
  sample_rate_hz: number;
  reading: Record<string, unknown>;
  app_version: string;
  build_number: number;
  bundle_id: string | null;
  shared_at_ms: number;
  state: string;
}

/** What was written for one sample, for the line the command prints. */
export interface PulledSample {
  dir: string;
  title: string;
  durationMs: number;
  noteCount: number;
  /** Set when the audio could not be fetched; the reading is still written. */
  problem: string | null;
}

/** Everything shared, oldest first — or only what has not been pulled. */
export async function listSamples(
  pb: PocketBase,
  all: boolean
): Promise<Sample[]> {
  return pb.collection(TAKE_SAMPLES_COLLECTION).getFullList<Sample>({
    filter: all ? '' : 'state = "shared"',
    sort: 'shared_at_ms'
  });
}

/**
 * Write one sample into its own directory: the recording, and the reading
 * that recording produced.
 *
 * Two files rather than one, and neither of them a log. Whatever reads
 * this next wants to open an audio file and parse some JSON, and anything
 * that has to be scraped out of prose first is a corpus that only the
 * program that wrote it can use.
 */
export async function writeSample(
  pb: PocketBase,
  sample: Sample,
  outDir: string
): Promise<PulledSample> {
  const dir = join(outDir, sampleDirName({
    id: sample.id,
    title: sample.title,
    sharedAtMs: sample.shared_at_ms
  }));
  await mkdir(dir, { recursive: true });

  const reading = {
    ...sample.reading,
    noteId: sample.note_id,
    title: sample.title,
    durationMs: sample.duration_ms,
    sampleRateHz: sample.sample_rate_hz,
    appVersion: sample.app_version,
    buildNumber: sample.build_number,
    bundleId: sample.bundle_id,
    sharedAtMs: sample.shared_at_ms
  };
  await writeFile(
    join(dir, 'reading.json'),
    `${JSON.stringify(reading, null, 2)}\n`
  );

  const notes = sample.reading.melody;
  const result: PulledSample = {
    dir,
    title: sample.title,
    durationMs: sample.duration_ms,
    noteCount: Array.isArray(notes) ? notes.length : 0,
    problem: null
  };

  if (!sample.audio) {
    // A sample whose audio the server no longer has. Reported rather than
    // written empty: a zero-byte wav in a corpus is a detector bug waiting
    // to be blamed on the detector.
    result.problem = 'the server has no audio for this sample';
    return result;
  }

  const url = pb.files.getURL(
    { id: sample.id, collectionName: TAKE_SAMPLES_COLLECTION },
    sample.audio
  );
  try {
    const response = await fetch(url);
    if (!response.ok) {
      result.problem = `audio fetch failed: ${response.status}`;
      return result;
    }
    const ext = sample.audio.split('.').pop() ?? 'wav';
    await writeFile(
      join(dir, `audio.${ext}`),
      Buffer.from(await response.arrayBuffer())
    );
  } catch (error) {
    result.problem = `audio fetch failed: ${String(error)}`;
  }
  return result;
}

/**
 * Say a sample has been pulled, so the next run downloads nothing.
 *
 * Only after the audio is on disk. Marking first and failing second is how
 * a corpus ends up with a reading and no recording and no way to notice.
 */
export async function markPulled(pb: PocketBase, id: string): Promise<void> {
  await pb.collection(TAKE_SAMPLES_COLLECTION).update(id, {
    state: 'pulled',
    pulled_at_ms: Date.now()
  });
}
