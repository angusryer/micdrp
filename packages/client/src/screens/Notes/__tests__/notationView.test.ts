/**
 * The reading on screen — ACC-NOTES-036, ACC-NOTES-037.
 *
 * What matters beyond the pure mapping is that this is a view and not an edit:
 * the stored melody is the same melody whichever way it is being read, and a
 * take with no metre is never left holding a reading it cannot be drawn in.
 *
 * `renderHook` is async in this setup — await it, as the sibling suites do.
 */
import { act, renderHook } from '@testing-library/react-native';

import { quantize, type NoteEvent } from 'logic';

import { useNotationView } from '../useNotationView';

const melody: NoteEvent[] = [
  { midi: 60, startMs: 12, endMs: 505, durationMs: 493, cents: -18, clarity: 0.9 },
  { midi: 62, startMs: 507, endMs: 1010, durationMs: 503, cents: 11, clarity: 0.9 },
  { midi: 64, startMs: 1013, endMs: 1495, durationMs: 482, cents: -6, clarity: 0.9 },
  { midi: 65, startMs: 1502, endMs: 2000, durationMs: 498, cents: 4, clarity: 0.9 }
];
const quantized = quantize(melody).notes;

describe('useNotationView', () => {
  it('starts as sung, which is what a note offers before anything is chosen', async () => {
    const { result } = await renderHook(() =>
      useNotationView(melody, quantized, true)
    );
    expect(result.current.view).toBe('as-sung');
    expect(result.current.notes).toEqual(melody);
  });

  it('ACC-NOTES-036: choosing the written reading draws it on the grid', async () => {
    const { result } = await renderHook(() =>
      useNotationView(melody, quantized, true)
    );
    await act(async () => result.current.setView('as-notated'));
    expect(result.current.view).toBe('as-notated');
    expect(result.current.notes.map((n) => n.startMs)).toEqual(
      quantized.map((n) => n.gridStartMs)
    );
    expect(result.current.notes.every((n) => n.cents === 0)).toBe(true);
  });

  it('ACC-NOTES-037: the reading leaves the stored melody alone', async () => {
    const before = JSON.stringify(melody);
    const { result } = await renderHook(() =>
      useNotationView(melody, quantized, true)
    );
    await act(async () => result.current.setView('as-notated'));
    expect(JSON.stringify(melody)).toBe(before);
  });

  it('a take with no metre is not offered the written reading', async () => {
    const { result } = await renderHook(() =>
      useNotationView(melody, quantized, false)
    );
    expect(result.current.canNotate).toBe(false);
    await act(async () => result.current.setView('as-notated'));
    // Asked for anyway, it stays as sung rather than drawing a grid it has
    // no evidence for.
    expect(result.current.view).toBe('as-sung');
    expect(result.current.notes).toEqual(melody);
  });

  it('a take with no notes to quantize cannot be written either', async () => {
    const { result } = await renderHook(() => useNotationView(melody, [], true));
    expect(result.current.canNotate).toBe(false);
  });
});
