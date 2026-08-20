/**
 * Which over-the-air bundle produced the behaviour being complained about.
 *
 * Without this a remark cannot be tied to the JavaScript that caused it: the
 * binary can stay the same while the bundle under it changes several times a
 * day, which is the entire point of the updates domain.
 */
import { HotUpdater } from '@hot-updater/react-native';

/** The running bundle, or null when the binary's own is in use. */
export function runningBundleId(): string | null {
  try {
    const id = HotUpdater.getBundleId();
    // The nil id means "no bundle applied"; null says that more plainly.
    return id && !/^0+-0+-0+-0+-0+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
