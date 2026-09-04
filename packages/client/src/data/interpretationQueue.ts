/**
 * Getting what a person did to a take up to the server (INV-NOTES-197).
 *
 * A take has exactly two things that cannot be produced again: the
 * recording, and what a person did to it. The recording has an upload
 * queue. This did not — one catch that set a flag nothing surfaced, no
 * retry, and no memory of the attempt. So beats tapped offline were gone,
 * and so were beats tapped before the note itself had uploaded, because a
 * note takes a new id when it arrives and the save went to an id the
 * server had never heard of.
 *
 * Sixteen tapped beats were lost that way, on a take whose reading
 * reported no tempo at all. Nothing failed loudly; the marks were simply
 * not there afterwards.
 *
 * One entry per note, not one per change: an interpretation is the whole
 * of what a person has decided about a take, so the newest replaces the
 * one waiting rather than queueing behind it.
 */
import type { InterpretationDto } from 'shared';

import { notesRepo } from './notesRepo';
import { getJSON, setJSON } from './store';

/** MMKV key. Stable by contract: changing it strands what is queued. */
const QUEUE_KEY = 'notes.interpretations.pending';

interface Pending {
  noteId: string;
  interpretations: InterpretationDto[];
  /** When it was last changed, for reporting how long it has been stuck. */
  atMs: number;
  /**
   * Which version of this take's interpretation is waiting.
   *
   * A counter rather than the timestamp beside it, because this is used as
   * identity: two changes inside one millisecond share an `atMs`, and a
   * save that finished between them would then look unchanged and clear
   * the newer one away.
   */
  seq: number;
}

/** Rises for every change. Not persisted: it only has to order one run. */
let seq = 0;

const read = (): Pending[] => getJSON<Pending[]>(QUEUE_KEY) ?? [];
const write = (queue: Pending[]): void => setJSON(QUEUE_KEY, queue);

/**
 * Remember an interpretation until the server has it.
 *
 * Written before the attempt rather than after a failure: a save that is
 * interrupted between sending and answering leaves nothing behind
 * otherwise, and losing a decision is the one outcome that matters here.
 */
export function queueInterpretations(
  noteId: string,
  interpretations: readonly InterpretationDto[]
): void {
  seq += 1;
  write([
    ...read().filter((held) => held.noteId !== noteId),
    { noteId, interpretations: [...interpretations], atMs: Date.now(), seq }
  ]);
}

/** Note that a take was renamed by the server, so its queued work follows. */
export function renameQueued(fromId: string, toId: string): void {
  const queue = read();
  if (!queue.some((held) => held.noteId === fromId)) {
    return;
  }
  write(
    queue
      // Anything already waiting under the new id is newer, so it wins.
      .filter((held) => held.noteId !== toId)
      .map((held) => (held.noteId === fromId ? { ...held, noteId: toId } : held))
  );
}

/** What is waiting, and since when. */
export function pendingInterpretations(): Pending[] {
  return read();
}

/**
 * Send everything waiting.
 *
 * One at a time and stopping at the first failure, like the note queue: the
 * usual reason one save fails is that the network or the session is gone,
 * and the rest will fail the same way a little more slowly.
 *
 * A save refused because the note does not exist is kept rather than
 * dropped — that is what a note not yet uploaded looks like, and it will
 * exist shortly.
 */
export async function flushInterpretations(): Promise<number> {
  let sent = 0;
  for (const held of read()) {
    try {
      await notesRepo.saveInterpretations(held.noteId, held.interpretations);
    } catch {
      break;
    }
    // Re-read rather than filtering the list this loop started with: a
    // change made while the request was in flight must not be dropped.
    const now = read().find((q) => q.noteId === held.noteId);
    if (now == null || now.seq === held.seq) {
      write(read().filter((q) => q.noteId !== held.noteId));
    }
    sent += 1;
  }
  return sent;
}

/** Test seam. Never called by app code. */
export function resetInterpretationQueueForTests(): void {
  write([]);
}
