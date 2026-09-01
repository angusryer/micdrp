/**
 * INV-NOTES-191 — the room a page keeps is the room every open sheet needs.
 *
 * Two sheets wrote one number, so whichever was dismissed first set the room
 * to zero while the other was still covering the page. The analysis sheet and
 * the selection sheet are open together whenever a note is chosen while the
 * knobs are being turned, which is most of the time they are turned at all.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useSheetCover } from '../useSheetCover';

describe('room kept under more than one sheet', () => {
  it('keeps what the deepest one needs', async () => {
    const { result } = await renderHook(() => useSheetCover());
    await act(async () => {
      result.current.report('selection', 200);
      result.current.report('note-analysis', 420);
    });
    expect(result.current.cover).toBe(420);
  });

  it('still keeps room for the one that is left', async () => {
    const { result } = await renderHook(() => useSheetCover());
    await act(async () => {
      result.current.report('selection', 200);
      result.current.report('note-analysis', 420);
    });
    await act(async () => {
      result.current.report('note-analysis', 0);
    });
    expect(result.current.cover).toBe(200);
  });

  it('gives it all back when the last has gone', async () => {
    const { result } = await renderHook(() => useSheetCover());
    await act(async () => {
      result.current.report('selection', 200);
    });
    await act(async () => {
      result.current.report('selection', 0);
    });
    expect(result.current.cover).toBe(0);
  });

  it('keeps none before anything opens', async () => {
    const { result } = await renderHook(() => useSheetCover());
    expect(result.current.cover).toBe(0);
  });
});
