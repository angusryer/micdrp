/**
 * The numbers the recording session runs on, and where the clip came from.
 *
 * The cap and the warning threshold are here rather than inline so the control
 * and the session cannot disagree about them — one source, and the tests read
 * the same one the app does.
 */
import Config from 'react-native-config';

/**
 * How long a single clip may run before it sends itself.
 *
 * Two minutes: long enough to walk a couple of screens and say what is wrong,
 * short enough that a forgotten recording is not a large upload. Reaching it
 * sends the clip rather than discarding it — the words already spoken are
 * worth the same as if stop had been pressed (INV-DOG-003).
 */
export const CLIP_CAP_MS = 120_000;

/**
 * When the countdown appears. Before this the control shows elapsed time, so
 * the clock is not something to watch until it matters.
 */
export const COUNTDOWN_AT_MS = 10_000;

/**
 * How often the session recomputes elapsed time. Fast enough that the last ten
 * seconds tick visibly, slow enough not to re-render the tree pointlessly.
 */
export const TICK_MS = 250;

/** Where a recording is written before it is uploaded. */
export const CLIP_SUBDIRECTORY = 'dogfood';

/** What produced the clip, so a stale remark can be recognised as stale. */
export type ClipOrigin = {
  appVersion: string;
  buildNumber: number;
};

/**
 * Read the recording binary's identity.
 *
 * The bundle id is not here: it comes from the updates domain at record time,
 * because it changes without the binary changing.
 */
export function readClipOrigin(): ClipOrigin {
  return {
    appVersion: (Config.VERSION_NUMBER ?? '').trim(),
    buildNumber: Number.parseInt(Config.BUILD_NUMBER ?? '0', 10) || 0
  };
}
