/**
 * INV-UPD-022 — a bundle that has arrived is not the one running.
 *
 * `getBundleId()` returns a downloaded bundle as soon as it is staged, before
 * any reload. Reporting that as the running bundle told a tester they had a
 * fix while the app went on executing the JavaScript from before it.
 */
import { HotUpdater } from '@hot-updater/react-native';

import { embeddedBundle, runningBundle, stagedBundle } from '../bundle';

const sdk = HotUpdater as unknown as {
  getBundleId: jest.Mock;
  getMinBundleId: jest.Mock;
  isUpdateDownloaded: jest.Mock;
};

const BUILT_IN = '00000000-0000-0000-0000-000000000000';

beforeEach(() => {
  sdk.getMinBundleId.mockReturnValue(BUILT_IN);
  sdk.getBundleId.mockReturnValue(BUILT_IN);
  sdk.isUpdateDownloaded.mockReturnValue(false);
});

describe('what this install is on', () => {
  it('names the applied bundle when nothing is waiting', () => {
    sdk.getBundleId.mockReturnValue('b7');
    expect(runningBundle()).toBe('b7');
    expect(stagedBundle()).toBeNull();
  });

  it('names a downloaded bundle as waiting, not as running', () => {
    sdk.getBundleId.mockReturnValue('b9');
    sdk.isUpdateDownloaded.mockReturnValue(true);
    expect(stagedBundle()).toBe('b9');
    expect(runningBundle()).not.toBe('b9');
  });

  it('reports nothing where the binary is running its own', () => {
    expect(runningBundle()).toBeNull();
    expect(stagedBundle()).toBeNull();
    expect(embeddedBundle()).toBe(BUILT_IN);
  });

  it('stays quiet when the native side will not answer', () => {
    sdk.getBundleId.mockImplementation(() => {
      throw new Error('no native module');
    });
    expect(runningBundle()).toBeNull();
    expect(stagedBundle()).toBeNull();
  });
});
