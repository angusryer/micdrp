/**
 * INV-NOTES-151 — a neck put away stays away, for that note.
 *
 * The neck takes real height under a graph already given half the screen, and
 * a singer with no guitar in the room has no use for it. Putting it away has
 * to hold, or the control is a thing you press on every visit.
 *
 * `renderHook` and `unmount` are both async in this setup — await them, or an
 * act scope stays open and every test after this one reads a null hook.
 */
import { act, renderHook } from '@testing-library/react-native';

import { remove } from '../../../data/store';
import { useNeckShown } from '../useNeckShown';

const ONE = 'note-one';
const TWO = 'note-two';

beforeEach(() => {
  remove(`notes.${ONE}.neckShown`);
  remove(`notes.${TWO}.neckShown`);
});

describe('whether the neck is shown', () => {
  it('shows it before anybody chooses', async () => {
    const { result } = await renderHook(() => useNeckShown(ONE));
    expect(result.current.neckShown).toBe(true);
  });

  it('remembers it having been put away', async () => {
    const first = await renderHook(() => useNeckShown(ONE));
    await act(() => first.result.current.setNeckShown(false));
    await first.unmount();

    const again = await renderHook(() => useNeckShown(ONE));
    expect(again.result.current.neckShown).toBe(false);
  });

  it('keeps the answer to itself — another note is unaffected', async () => {
    const first = await renderHook(() => useNeckShown(ONE));
    await act(() => first.result.current.setNeckShown(false));
    await first.unmount();

    const other = await renderHook(() => useNeckShown(TWO));
    expect(other.result.current.neckShown).toBe(true);
  });

  it('has somewhere to put the answer even with no note', async () => {
    const { result } = await renderHook(() => useNeckShown(null));
    await act(() => result.current.setNeckShown(false));
    expect(result.current.neckShown).toBe(false);
  });
});
