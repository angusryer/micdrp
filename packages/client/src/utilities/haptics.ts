/**
 * haptics — a tick against the fingertip, when the binary can give one.
 *
 * Wrapped rather than called directly so every call site stays one line and
 * none of them has to think about the module being absent. Bundles ship over
 * the air to binaries built before this existed, so absent is normal and
 * silent (INV-NOTES-030) — feedback is the last thing that should take an app
 * down.
 */
import NativeHaptics from '../specs/NativeHaptics';

const LIGHT = 0;
const MEDIUM = 1;

/** The moment a gesture takes hold of something. */
export function tapped(): void {
  NativeHaptics?.impact(LIGHT);
}

/** A heavier note, for a change that cannot be undone by carrying on. */
export function committed(): void {
  NativeHaptics?.impact(MEDIUM);
}
