/**
 * outputRoute — best-effort detection of whether headphones (wired or Bluetooth)
 * are the current audio output.
 *
 * Practice uses this to decide how the reference melody is presented:
 *   - headphones connected → play the reference WHILE recording (play-along),
 *     since the mic won't capture tones that go to the singer's ears;
 *   - otherwise → play a count-in preview, then record in silence so the speaker
 *     output never bleeds into the take.
 *
 * React Native has no first-class audio-route API, so detection is pluggable.
 * `registerNativeProbe` fills it from AVAudioSession where the binary has that
 * module; tests inject their own through {@link setHeadphoneProbe}. With
 * nothing registered we return `false` (speaker → count-in) — the safe default,
 * which never feeds the reference into the mic, and the one a bundle running on
 * an older binary falls back to.
 */
import NativeAudioRoute from '../specs/NativeAudioRoute';

/** A probe returns true when headphones are the active output. */
export type HeadphoneProbe = () => Promise<boolean> | boolean;

let injectedProbe: HeadphoneProbe | null = null;

/**
 * Ask the native side, when the binary has it.
 *
 * This slot sat empty from the day the file was written, so every caller has
 * been told "speaker" for the app's whole life — which meant Practice's
 * play-along mode, the whole reason this exists, never once engaged.
 */
export function registerNativeProbe(): void {
  const native = NativeAudioRoute;
  if (native) {
    injectedProbe = () => native.isHeadphones();
  }
}

/**
 * Register (or clear, with `null`) the headphone-route probe. Wire a native
 * module here once available; tests use it to simulate either route.
 */
export function setHeadphoneProbe(probe: HeadphoneProbe | null): void {
  injectedProbe = probe;
}

/**
 * Resolve whether headphones are currently the audio output. Never rejects —
 * any probe error resolves to `false` (assume speaker), so callers can choose a
 * presentation mode without guarding.
 */
export async function detectHeadphonesConnected(): Promise<boolean> {
  if (!injectedProbe) {
    // No route probe registered (no native capability yet) → assume speaker.
    return false;
  }
  try {
    return Boolean(await injectedProbe());
  } catch {
    return false;
  }
}
