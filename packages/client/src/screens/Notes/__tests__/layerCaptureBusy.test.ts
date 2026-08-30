/**
 * INV-UPD-024 — nothing holds the update prompt back after it has ended.
 *
 * An overdub declared itself busy when it started and released on stop, so
 * leaving the screen mid-take left the app busy for the rest of the session.
 * A prompt suppressed that way is indistinguishable from no update at all.
 */
import { act, renderHook } from '@testing-library/react-native';

import { isBusy, resetBusyForTests } from '../../../app/activity';
import { useLayerCapture } from '../useLayerCapture';

jest.mock('../../../audio', () => ({
  audioEngine: {
    requestPermission: jest.fn(() => Promise.resolve(true)),
    roundTripLatencyMs: jest.fn(() => Promise.resolve(20)),
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve({}))
  }
}));

beforeEach(() => {
  resetBusyForTests();
});

describe('an overdub that is walked away from', () => {
  it('lets the prompt through again once its screen is gone', async () => {
    const { result, unmount } = await renderHook(() =>
      useLayerCapture(null, [], jest.fn())
    );
    await act(async () => {
      await result.current.start('bass');
    });
    expect(isBusy()).toBe(true);
    await act(async () => {
      await unmount();
    });
    expect(isBusy()).toBe(false);
  });
});
