/**
 * INV-NOTES-138 — the recording view keeps the screen awake.
 *
 * A phone that dims mid-take stopped showing the thing it was asked to show,
 * at the one moment nobody has a free hand. Released whatever route the view
 * is left by: a flag nobody clears is a phone that never sleeps again.
 *
 * `renderHook` is async in this setup — await it.
 */
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../../../specs/NativeScreenWake', () => ({
  __esModule: true,
  default: { setAwake: jest.fn() }
}));

import { useScreenAwake } from '../useScreenAwake';
import NativeScreenWake from '../../../specs/NativeScreenWake';

const wake = NativeScreenWake as { setAwake: jest.Mock };

beforeEach(() => wake.setAwake.mockClear());

describe('holding the screen awake', () => {
  it('holds it for as long as the view is open', async () => {
    await renderHook(() => useScreenAwake());
    expect(wake.setAwake).toHaveBeenCalledWith(true);
  });

  it('lets it sleep again when the view goes', async () => {
    const { unmount } = await renderHook(() => useScreenAwake());
    // Awaited: an unmount left in flight leaks into whatever runs next.
    await act(async () => {
      await unmount();
    });
    expect(wake.setAwake).toHaveBeenLastCalledWith(false);
  });

  it('asks for nothing where it was not wanted', async () => {
    await renderHook(() => useScreenAwake(false));
    expect(wake.setAwake).not.toHaveBeenCalled();
  });
});
