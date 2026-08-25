/**
 * Codegen spec for keeping the screen awake.
 *
 * This has to be native: the idle timer belongs to UIApplication and there is
 * no JavaScript route to it. A phone that dims mid-take stopped showing the
 * thing it was asked to show, at the one moment nobody has a free hand
 * (INV-NOTES-138).
 *
 * A flag rather than a duration, because what it tracks is a view being open,
 * and a view that is open has no length known in advance.
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * Hold the screen awake, or let it sleep again. Idempotent: setting what is
   * already set is not an error, which is what lets a view call it on every
   * mount without tracking whether it was the one that set it.
   */
  setAwake(isAwake: boolean): void;
}

/**
 * `get`, never `getEnforcing`. A screen that dims is worse than a screen that
 * dims; a crash on mount is worse than both.
 */
export default TurboModuleRegistry.get<Spec>('NativeScreenWake');
