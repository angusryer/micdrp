/**
 * Codegen spec for touch feedback.
 *
 * This has to be native: JavaScript can reach React Native's `Vibration`, but
 * that is the old whole-phone buzz, not the Taptic Engine. A pick-up wants a
 * tick you feel in the fingertip and barely hear, which is
 * `UIImpactFeedbackGenerator` and nothing else.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  /**
   * A tap against the fingertip. `weight` is 0 light, 1 medium, 2 heavy;
   * anything else is treated as light, since the wrong tick is better than a
   * crash on the gesture path.
   */
  impact(weight: Double): void;
}

/**
 * `get`, never `getEnforcing`. Bundles ship over the air to binaries built
 * before this existed, and feedback is the last thing that should take an
 * app down (INV-NOTES-030).
 */
export default TurboModuleRegistry.get<Spec>('NativeHaptics');
