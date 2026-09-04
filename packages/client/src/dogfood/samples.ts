/**
 * Deciding to hand a take over. Sending it is in sampleUpload.ts, and
 * taking it back is in sampleRecord.ts.
 *
 * Deliberately a different collection from the spoken clips, and nothing
 * here ever writes to that one. A clip is speech and carries an
 * instruction; a sample is singing and carries none, and an unattended
 * loop that transcribed one would find words in it and act on them
 * (INV-DOG-036).
 */
import {
  readingFingerprint,
  readingOf,
  type NoteEventDto,
  type ReadableTake
} from 'shared';

import { readClipOrigin } from './config';
import { runningBundleId } from './origin';
import { flushShares, noteShareProblem } from './sampleUpload';
import { pendingShare, queueShare, sharedTake } from './shares';
import { takeSource } from './takeSource';

/** Everything sharing one take needs that this module cannot work out. */
export interface ShareTakeInput {
  noteId: string;
  title: string;
  durationMs: number;
  sampleRateHz: number;
  /** The reading as it stands now, frozen into the sample (INV-DOG-032). */
  take: ReadableTake;
  /**
   * The melody with hand corrections replayed onto it, when there are
   * any. Stored beside the raw hearing rather than instead of it: the
   * difference between the two is what the reading got wrong.
   */
  corrected?: NoteEventDto[];
  /** The take's audio, by the same rule the player and the re-read use. */
  resolveAudio: () => Promise<string | null>;
  /**
   * The uploaded copy's durable name, or null. Only reached for when the
   * device's own copy has gone, which is every take after a reinstall.
   */
  audioPath?: string | null;
}

/**
 * Mark a take to share, and try to send it now.
 *
 * Returns the reason it could not be marked, or null. Failing to *send* is
 * not one of those reasons: the share is queued and retried, and the
 * control says it is waiting rather than saying it is done (INV-DOG-033).
 */
export async function shareTake(input: ShareTakeInput): Promise<string | null> {
  const reading = readingOf(input.take, input.corrected);
  const readingHash = readingFingerprint(reading);
  // Refused only when this exact reading is already up. A take read again
  // is new evidence about the same recording, and comparing two readings
  // of one take is the whole point of the corpus (INV-DOG-034).
  if (sharedTake(input.noteId)?.readingHash === readingHash) {
    return null;
  }
  if (pendingShare(input.noteId)?.readingHash === readingHash) {
    return null;
  }
  const source = await takeSource(
    input.noteId,
    input.resolveAudio,
    input.audioPath ?? null
  );
  if (source == null) {
    const problem = 'no recording on this device to send';
    noteShareProblem(problem);
    return problem;
  }
  const origin = readClipOrigin();
  queueShare({
    noteId: input.noteId,
    title: input.title,
    audioUri: source.audioUri,
    isTemp: source.isTemp,
    audioExt: source.audioExt,
    durationMs: input.durationMs,
    sampleRateHz: input.sampleRateHz,
    reading,
    readingHash,
    appVersion: origin.appVersion,
    buildNumber: origin.buildNumber,
    bundleId: runningBundleId(),
    sharedAtMs: Date.now()
  });
  noteShareProblem(null);
  void flushShares();
  return null;
}
