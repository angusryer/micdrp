/**
 * Getting a recording onto the disk, so the analyser can open it.
 *
 * The analyser reads with AVAudioFile, which opens local files and nothing
 * else — handed an https URL it built a nonsense file path out of it and
 * failed. Playback had already met this and fetches to a scratch file first;
 * the analyser never did, so a take whose local copy had gone — which is every
 * take after a reinstall — could be played but not re-read (INV-NOTES-185).
 *
 * In JavaScript rather than in the native decoder that already does it,
 * because that keeps the fix shippable to the binary already installed.
 */
import {
  downloadFile,
  exists,
  mkdir,
  TemporaryDirectoryPath,
  unlink
} from '@dr.pogodin/react-native-fs';

/** Where a fetched copy is put, and what it is called. */
const SCRATCH = `${TemporaryDirectoryPath}/reread`;

/** Whether this is something the analyser can already open. */
export function isOnDisk(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('/');
}

export interface LocalCopy {
  path: string;
  /** Remove it, where it was fetched. A copy already on disk is left alone. */
  release: () => Promise<void>;
}

const noop = (): Promise<void> => Promise.resolve();

/**
 * A path the analyser can open, fetching the recording first if it must.
 *
 * Null where there is nothing to read: no address, or a fetch that did not
 * arrive. The caller reports that; this does not guess at why.
 */
export async function localCopyOf(uri: string): Promise<LocalCopy | null> {
  if (uri.length === 0) {
    return null;
  }
  if (isOnDisk(uri)) {
    // Already readable — unless it is not there any more, which is what a
    // reinstall leaves behind.
    const path = uri.replace(/^file:\/\//, '');
    return (await exists(path)) ? { path, release: noop } : null;
  }

  await mkdir(SCRATCH).catch(() => undefined);
  // Named for this attempt rather than for the take: two reads of one take
  // must not fetch over each other, and the name never has to be unpicked
  // because it is deleted either way.
  const path = `${SCRATCH}/take-${String(Date.now())}.audio`;
  const release = async (): Promise<void> => {
    await unlink(path).catch(() => undefined);
  };

  try {
    const { statusCode } = await downloadFile({
      fromUrl: uri,
      toFile: path
    }).promise;
    if (statusCode == null || statusCode >= 400) {
      await release();
      return null;
    }
    return { path, release };
  } catch {
    await release();
    return null;
  }
}
