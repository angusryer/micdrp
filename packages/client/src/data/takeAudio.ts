/**
 * Whether a take has a recording behind it, asked once (INV-NOTES-186).
 *
 * Since capture became local first (INV-NOTES-139) a take exists on the
 * device before it exists on the server, and may never reach the server at
 * all. So "is the uploaded path set" is a different question from "is there a
 * recording", and four places had been asking the first while meaning the
 * second: the list card, the detail player, the sideways player, and reading
 * the take again.
 *
 * Four copies of a question are four chances to ask it the wrong way, which
 * is how the fourth was still wrong a day after the third was fixed.
 */

/** As much of a note as this needs. */
export interface HasTakeAudio {
  audioPath?: string | null;
  localAudioUri?: string | null;
}

/** Whether there is a recording to play or read, wherever it lives. */
export function hasTakeAudio(note: HasTakeAudio | null | undefined): boolean {
  return note?.audioPath != null || note?.localAudioUri != null;
}
