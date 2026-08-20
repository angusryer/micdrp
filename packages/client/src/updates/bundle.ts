/**
 * Which over-the-air bundle is running.
 *
 * The same question `dogfood/origin.ts` asks, and it belongs here — the
 * updates domain owns what a bundle is. dogfood re-exports it rather than
 * asking hot-updater separately.
 */
import { HotUpdater } from '@hot-updater/react-native';

/** The nil id hot-updater reports when no bundle has been applied. */
const NIL = /^0+-0+-0+-0+-0+$/;

/** The running bundle, or null when the binary's own is in use. */
export function runningBundle(): string | null {
  try {
    const id = HotUpdater.getBundleId();
    return id && !NIL.test(id) ? id : null;
  } catch {
    return null;
  }
}
