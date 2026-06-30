/**
 * Filesystem path helpers for captured audio + exported MIDI blobs.
 *
 * MMKV holds only the lightweight index (see `recordings.ts`); the heavy bytes —
 * the captured audio and any exported `.mid` — live on disk under the app's
 * document directory, addressed deterministically by recording id. This module is
 * the single seam onto `react-native-fs`.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-PERSIST).
 */
import RNFS from 'react-native-fs';

/** Subdirectory (under the document dir) that holds all per-recording artifacts. */
export const RECORDINGS_SUBDIR = 'recordings';

/** Absolute path to the directory holding all recording artifacts. */
export function recordingsDir(): string {
  return `${RNFS.DocumentDirectoryPath}/${RECORDINGS_SUBDIR}`;
}

/** Absolute path to the captured audio file for a recording (`.wav`). */
export function audioPath(id: string): string {
  return `${recordingsDir()}/${id}.wav`;
}

/** Absolute path to the exported MIDI file for a recording (`.mid`). */
export function midiPath(id: string): string {
  return `${recordingsDir()}/${id}.mid`;
}

/** Ensure the recordings directory exists. Idempotent. */
export async function ensureDirs(): Promise<void> {
  const dir = recordingsDir();
  const exists = await RNFS.exists(dir);
  if (!exists) {
    await RNFS.mkdir(dir);
  }
}

/** Base64 alphabet for the dependency-free byte encoder below. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode raw bytes to a base64 string. `react-native-fs` writes strings only, so
 * binary blobs (MIDI) must be base64-encoded with `encoding: 'base64'`. Kept local
 * and pure (no `Buffer`/`btoa` dependency) so it is testable on any host.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < len ? B64[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < len ? B64[b2 & 0x3f] : '=';
  }
  return out;
}

/**
 * Write MIDI bytes for a recording and resolve with the `file://` URI of the
 * written `.mid`. Ensures the directory exists first.
 */
export async function writeMidi(id: string, bytes: Uint8Array): Promise<string> {
  await ensureDirs();
  const path = midiPath(id);
  await RNFS.writeFile(path, bytesToBase64(bytes), 'base64');
  return `file://${path}`;
}

/**
 * Remove all on-disk artifacts (audio + midi) for a recording. Missing files are
 * ignored so this is safe to call on a partially-written recording.
 */
export async function deleteRecordingFiles(id: string): Promise<void> {
  await Promise.all(
    [audioPath(id), midiPath(id)].map(async (p) => {
      try {
        if (await RNFS.exists(p)) {
          await RNFS.unlink(p);
        }
      } catch {
        // Best-effort cleanup; a missing/locked file must not fail deletion.
      }
    })
  );
}
