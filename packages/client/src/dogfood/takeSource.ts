/**
 * Finding a file to send for a take, wherever its audio happens to live.
 *
 * A take has up to two copies: the one on this device, written when it was
 * sung, and the one on the server, written when it was uploaded. Either
 * may be missing — a take not yet uploaded has only the first, and every
 * take after a reinstall has only the second (INV-NOTES-185).
 *
 * The fetching is `localCopyOf`, which the re-read already uses. What is
 * different here is only that the answer has to survive being written to
 * disk: a queued share may wait days, so a closure that knows how to clean
 * up is no use and a path plus a flag is.
 */
import { unlink } from '@dr.pogodin/react-native-fs';
import { audioExtensionOf } from 'shared';

import { localCopyOf } from '../analysis/localCopy';
import { notesRepo } from '../data/notesRepo';

/** A file to upload, and whether sending it means cleaning it up. */
export interface TakeSource {
  audioUri: string;
  /** True when this is a copy made here, not the take's own recording. */
  isTemp: boolean;
  /**
   * The take's own extension, read off where its audio lives rather than
   * off the copy. A fetched copy is named for the attempt that fetched it
   * and says nothing about the format, so naming the upload after it would
   * put a file called `audio.audio` in the corpus.
   */
  audioExt: string;
}

/** Whether a resolved audio location is already a file on this device. */
function isLocal(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('/');
}

async function copyOf(uri: string | null): Promise<TakeSource | null> {
  if (uri == null || uri.length === 0) {
    return null;
  }
  const copy = await localCopyOf(uri);
  if (copy == null) {
    return null;
  }
  return {
    // Always a URI, never a bare path: this is handed to FormData, which
    // needs a scheme to read the file off disk.
    audioUri: copy.path.startsWith('file://') ? copy.path : `file://${copy.path}`,
    isTemp: !isLocal(uri),
    audioExt: audioExtensionOf(uri) || 'wav'
  };
}

/**
 * Get a local file for a take.
 *
 * `resolve` is the same one the player and the re-read use — the copy on
 * this device where there is one, and a fresh signed URL otherwise. Asking
 * it rather than reaching for either copy directly is what keeps this from
 * becoming another place that decides where a take's audio lives
 * (INV-NOTES-186).
 *
 * A local copy that is no longer there falls back to the uploaded one, by
 * the same rule the re-read follows and for the same reason: after a
 * reinstall the device path is still recorded and the file behind it is
 * gone.
 *
 * Returns null when the take has no recording anywhere, or when fetching
 * the server's copy failed — which offline is the same thing, and is worth
 * saying as "nothing to send from here" rather than retried in silence.
 */
export async function takeSource(
  noteId: string,
  resolve: () => Promise<string | null>,
  audioPath: string | null
): Promise<TakeSource | null> {
  const preferred = await copyOf(await resolve().catch(() => null));
  if (preferred != null || audioPath == null) {
    return preferred;
  }
  return copyOf(await notesRepo.audioUrlFor(noteId, audioPath).catch(() => null));
}

/** Remove a copy this module made. A copy it did not make is left alone. */
export async function releaseSource(source: {
  audioUri: string;
  isTemp: boolean;
}): Promise<void> {
  if (!source.isTemp) {
    return;
  }
  try {
    await unlink(source.audioUri.replace(/^file:\/\//, ''));
  } catch {
    // The sample is up, which is what mattered. A stray copy in the scratch
    // directory is not worth reporting or retrying.
  }
}
