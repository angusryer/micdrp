/**
 * Which over-the-air bundle is running, if any.
 *
 * `getBundleId()` falls back to the id compiled into the binary when no bundle
 * has been applied — it does not return the nil uuid. Build 7 displayed
 * `01a01967` in settings and looked as though a bundle were running when
 * nothing had been. Comparing against the build-time id is what tells the two
 * apart.
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

/** The applied bundle, or null when the binary's own is what is running. */
export function runningBundle(): string | null {
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
