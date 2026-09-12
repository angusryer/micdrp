/**
 * Getting the singer's engine settings into the engine (INV-ACCOUNT-015).
 *
 * Storing a setting and reading it back is not applying it. Every engine
 * field — the frequency bounds, the clarity thresholds, the level floor —
 * was written to the device store and read back only by the screen that
 * wrote it. Nothing ever called `configure`, so the native side ran on its
 * compiled-in defaults from launch to launch, and every one of those
 * controls did nothing at all.
 *
 * That cost a real reading: a whistled take sat at a median of 1238 Hz
 * against a ceiling of 1200, so more than half of it was dropped — which
 * read as a singer who drifted and left gaps rather than as a detector
 * that had stopped listening. The one control that would have fixed it
 * was the inert one.
 *
 * Not a hook, because the launch path has no component to hang one on and
 * the first capture must not be the thing that discovers the settings.
 */
import { audioEngine } from './AudioEngine';
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './contract';
import store from '../data/store';

/** MMKV key — keep stable; changing it orphans every device's settings. */
export const KEY_ENGINE_CONFIG = 'settings:engineConfig';

/** All overrides are optional; any key absent means "use the default". */
export type EngineConfigOverrides = Partial<EngineConfig>;

/** What the singer has changed, or nothing. */
export function storedOverrides(): EngineConfigOverrides {
  return store.getJSON<EngineConfigOverrides>(KEY_ENGINE_CONFIG) ?? {};
}

/**
 * The defaults with the singer's overrides on top. Always complete, so
 * whatever reads it never has to know which half a value came from.
 */
export function resolvedEngineConfig(): EngineConfig {
  return { ...DEFAULT_ENGINE_CONFIG, ...storedOverrides() };
}

/**
 * Hand the resolved settings to the engine.
 *
 * Called at launch and again after every change, rather than before each
 * capture: a re-read goes through its own engine instance built from the
 * same stored config, so anything that only configured on the way into a
 * recording would leave re-reading on the defaults for ever.
 *
 * Failure is swallowed deliberately. A device with no native engine falls
 * back to the worklet, and neither is worth an error at launch — the worst
 * outcome is the defaults, which is what happened before this existed.
 */
export async function applyEngineConfig(): Promise<void> {
  try {
    await audioEngine.configure(resolvedEngineConfig());
  } catch (error) {
    console.warn('[audio] could not apply engine settings', error);
  }
}

/**
 * The engine's part of a reading's recipe (INV-NOTES-263).
 *
 * Every setting that decides what the engine hears, as `engine.<key>`, so
 * it sits in the same flat map as the reader's thresholds and a new
 * dimension joins by adding a key. Read from the resolved config — what a
 * reading made now would actually be made with.
 */
export const ENGINE_RECIPE_KEYS = [
  'frameSize',
  'hopSize',
  'minFrequencyHz',
  'maxFrequencyHz',
  'clarityThreshold',
  'voicedClarityMin',
  'voicedLevelDb'
] as const;

export function engineReadWith(): Record<string, number> {
  const resolved = resolvedEngineConfig();
  const out: Record<string, number> = {};
  for (const key of ENGINE_RECIPE_KEYS) {
    out[`engine.${key}`] = resolved[key];
  }
  return out;
}

/**
 * The engine settings a recipe names, for re-reading a take the way it was
 * read. Empty where the recipe predates engine settings being recorded —
 * the caller then reads with today's, which is all it can do.
 */
export function engineConfigFrom(
  readWith: Record<string, number> | undefined
): Partial<EngineConfig> {
  const out: Partial<EngineConfig> = {};
  for (const key of ENGINE_RECIPE_KEYS) {
    const value = readWith?.[`engine.${key}`];
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}
