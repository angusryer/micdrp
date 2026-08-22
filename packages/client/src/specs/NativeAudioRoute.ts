/**
 * Codegen spec for what the audio is coming out of.
 *
 * `AVAudioSession.currentRoute` is the only thing that knows, and it is
 * native. outputRoute.ts has had a slot for this since it was written and
 * nothing ever filled it, so the app has assumed a speaker for its whole life
 * — which means Practice's play-along mode, the one that plays the reference
 * while recording because headphones keep it out of the microphone, has never
 * once engaged.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** True when the output is headphones, wired or Bluetooth. */
  isHeadphones(): boolean;
}

/**
 * `get`, never `getEnforcing`. Bundles ship over the air to binaries built
 * before this existed, and the fallback — assume a speaker — is the safe one
 * either way, since it never feeds the reference into the microphone.
 */
export default TurboModuleRegistry.get<Spec>('NativeAudioRoute');
