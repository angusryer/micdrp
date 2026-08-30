/**
 * Which over-the-air bundle is running, and which has merely arrived.
 *
 * `getBundleId()` falls back to the id compiled into the binary when no bundle
 * has been applied — it does not return the nil uuid. Build 7 displayed
 * `01a01967` in settings and looked as though a bundle were running when
 * nothing had been. Comparing against the build-time id is what tells the two
 * apart.
 *
 * It also returns a bundle the moment it is downloaded, before any reload, so
 * on its own it cannot say whether that bundle is the JavaScript actually
 * executing. `isUpdateDownloaded()` is what separates the two, and without it
 * the app told a tester they had a fix while running the code from before it
 * (INV-UPD-022).
 */
import { HotUpdater } from '@hot-updater/react-native';

/** The id compiled into the binary. Fixed for the life of that binary. */
export function embeddedBundle(): string | null {
  try {
    return HotUpdater.getMinBundleId() || null;
  } catch {
    return null;
  }
}

/** Whatever the native side currently points at, applied or merely staged. */
function currentBundle(): string | null {
  try {
    const current = HotUpdater.getBundleId();
    if (!current || current === embeddedBundle()) {
      return null;
    }
    return current;
  } catch {
    return null;
  }
}

/**
 * The bundle downloaded and waiting for a reload, or null when none is.
 *
 * A staged bundle is not what the app is running, however recently it
 * arrived: it becomes that at the next reload and not before.
 */
export function stagedBundle(): string | null {
  try {
    return HotUpdater.isUpdateDownloaded() ? currentBundle() : null;
  } catch {
    return null;
  }
}

/** The applied bundle, or null when the binary's own is what is running. */
export function runningBundle(): string | null {
  return stagedBundle() != null ? null : currentBundle();
}
