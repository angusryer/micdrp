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
 * React Native has no first-class audio-route API, so detection is pluggable: a
 * native module (or a future `react-native-audio-api` capability) can register a
 * probe via {@link setHeadphoneProbe}. With nothing registered we return `false`
 * (speaker → count-in) — the safe default that never feeds the reference into
 * the mic.
 */

/** A probe returns true when headphones are the active output. */
export type HeadphoneProbe = () => Promise<boolean> | boolean;

let injectedProbe: HeadphoneProbe | null = null;

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
