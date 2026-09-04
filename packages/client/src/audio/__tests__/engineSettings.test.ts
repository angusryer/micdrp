/**
 * INV-ACCOUNT-015 — a setting the singer changes reaches the thing it sets.
 *
 * Storing a value and reading it back is not applying it. Every engine
 * control on the account screen wrote to the device store and was read back
 * only by the screen that wrote it, so the detector ran on its compiled-in
 * defaults for ever — and the control that would have raised the pitch
 * ceiling for a whistled take did nothing at all.
 */
import { audioEngine } from '../AudioEngine';
import { DEFAULT_ENGINE_CONFIG } from '../contract';
import {
  applyEngineConfig,
  KEY_ENGINE_CONFIG,
  resolvedEngineConfig
} from '../engineSettings';
import store from '../../data/store';

const configure = jest.spyOn(audioEngine, 'configure');

beforeEach(() => {
  store.clearAll();
  configure.mockReset().mockResolvedValue(undefined);
});

describe('resolving what the engine should run on', () => {
  it('is the defaults when nothing has been changed', () => {
    expect(resolvedEngineConfig()).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('puts an override on top and leaves the rest alone', () => {
    store.setJSON(KEY_ENGINE_CONFIG, { maxFrequencyHz: 3000 });
    const resolved = resolvedEngineConfig();
    expect(resolved.maxFrequencyHz).toBe(3000);
    expect(resolved.minFrequencyHz).toBe(DEFAULT_ENGINE_CONFIG.minFrequencyHz);
  });
});

describe('applying it', () => {
  it('ACC-ACCOUNT-022: hands a stored setting to the engine', async () => {
    store.setJSON(KEY_ENGINE_CONFIG, { maxFrequencyHz: 2500 });
    await applyEngineConfig();
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({ maxFrequencyHz: 2500 })
    );
  });

  it('hands over a complete config, never a fragment', async () => {
    store.setJSON(KEY_ENGINE_CONFIG, { maxFrequencyHz: 2500 });
    await applyEngineConfig();
    // A partial merges into whatever the engine already held, which after a
    // reset would be the value being cleared rather than the default.
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining(
        Object.fromEntries(Object.keys(DEFAULT_ENGINE_CONFIG).map((k) => [k, expect.anything()]))
      )
    );
  });

  it('does not throw when there is no engine to configure', async () => {
    configure.mockRejectedValue(new Error('no native engine'));
    await expect(applyEngineConfig()).resolves.toBeUndefined();
  });
});

describe('the ceiling', () => {
  it('is set for whistling rather than for singing', () => {
    // A measured whistled take ran to a median of 1238 Hz and a peak of
    // 2309. At the old 1200 the detector discarded more than half of it and
    // the result read as a singer who drifted rather than as a detector
    // that had stopped listening.
    expect(DEFAULT_ENGINE_CONFIG.maxFrequencyHz).toBeGreaterThanOrEqual(2400);
  });
});
