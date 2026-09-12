/**
 * INV-NOTES-263 — the engine's settings travel with a reading as part of
 * its recipe, and come back out the same.
 */
import { engineConfigFrom, engineReadWith, ENGINE_RECIPE_KEYS } from '../engineSettings';
import { DEFAULT_ENGINE_CONFIG } from '../contract';

describe('the engine half of a recipe', () => {
  it('names every setting that decides what the engine hears, under engine.*', () => {
    const recipe = engineReadWith();
    for (const key of ENGINE_RECIPE_KEYS) {
      expect(recipe[`engine.${key}`]).toBe(DEFAULT_ENGINE_CONFIG[key]);
    }
  });

  it('round-trips into the config a re-read would use', () => {
    const recipe = engineReadWith();
    const back = engineConfigFrom(recipe);
    for (const key of ENGINE_RECIPE_KEYS) {
      expect(back[key]).toBe(DEFAULT_ENGINE_CONFIG[key]);
    }
  });

  it('is empty for a recipe that predates engine settings, not a guess', () => {
    // A take read before the engine was recorded: the caller reads with
    // today's settings, which is all it can honestly do.
    expect(engineConfigFrom({ 'segment.minDurationMs': 60 })).toEqual({});
    expect(engineConfigFrom(undefined)).toEqual({});
  });

  it('carries only what is a number', () => {
    expect(engineConfigFrom({ 'engine.frameSize': Number.NaN })).toEqual({});
  });
});
