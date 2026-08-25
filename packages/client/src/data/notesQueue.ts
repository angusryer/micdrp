/**
 * Getting the notes kept on this device up to the server (INV-NOTES-139).
 *
 * A capture lands locally and appears in the list at once; this is the part
 * that happens afterwards and is allowed to fail. It runs on a press, on a
 * screen coming into view, and after a capture — never on a timer, because a
 * queue that is empty most of the time should cost nothing most of the time.
 *
 * One at a time and oldest first. Uploads are whole audio files; several at
 * once on a phone's uplink is slower than one after another, and a take
 * finishing before an earlier one would put the list out of order for the
 * moment it takes the server to answer.
 *
 * A failure is left in place. There is no attempt counter and nothing is ever
 * discarded: the note is on the device and the device is where the singer
 * will look for it, so the worst outcome of never succeeding is a note that
 * only exists on one phone — which is what the app did all the time before.
 */
import type { CreateNoteInput } from 'shared';

import { notesRepo } from './notesRepo';
import { dtoToMeta } from './notesSync';
import { dropNote, pendingNotes, putNote } from './notesLocal';
import type { NoteMeta } from './notesCache';

/** What a pending note's create needs, read back off what was kept. */
function inputFor(note: NoteMeta): CreateNoteInput {
  return {
    title: note.title,
    durationMs: note.durationMs,
    sampleRateHz: note.sampleRateHz,
    melody: note.melody,
    hits: note.hits ?? [],
    analysisVersion: note.analysisVersion,
    noteCount: note.noteCount,
    key: note.key,
    tempoBpm: note.tempoBpm,
    inTuneRatio: note.inTuneRatio,
    meanCentsError: note.meanCentsError,
    rangeLowMidi: note.rangeLowMidi,
    rangeHighMidi: note.rangeHighMidi
  };
}

/** Nothing runs twice at once; a second call while one is in flight waits. */
let inFlight: Promise<number> | null = null;

/**
 * Send everything waiting. Resolves with how many made it.
 *
 * Stops at the first failure rather than working through the rest: the usual
 * reason one upload fails is that the network or the session is gone, and the
 * next nine will fail the same way a little more slowly.
 */
export async function flushPending(): Promise<number> {
  if (inFlight != null) {
    return inFlight;
  }
  inFlight = (async () => {
    let sent = 0;
    for (const note of pendingNotes()) {
      const uri = note.localAudioUri;
      if (uri == null) {
        // Nothing to upload and nothing to retry: a note with no audio on
        // this device cannot be sent, and leaving it pending forever would
        // make the queue never drain.
        putNote({ ...note, pendingSync: false });
        continue;
      }
      try {
        const dto = await notesRepo.create(inputFor(note), { audioUri: uri });
        // The server named it, so the local id retires. Written before the
        // old one is dropped: a crash between the two leaves a duplicate,
        // which is visible and fixable, rather than nothing, which is not.
        putNote({ ...dtoToMeta(dto), localAudioUri: uri, pendingSync: false });
        dropNote(note.id);
        sent += 1;
      } catch {
        break;
      }
    }
    return sent;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** How many are waiting, for anything that wants to say so. */
export function pendingCount(): number {
  return pendingNotes().length;
}
