/**
 * ACC-NOTES-216 / ACC-NOTES-217 / INV-NOTES-141 — what a note remembers
 * about its balance.
 *
 * The tracks start at the loudness the take was actually sung at, and a
 * level the singer moved wins over that and persists. "A level set by hand"
 * has to mean one that was actually moved: every level was being kept,
 * including the ones nobody had touched, so opening a note and toggling any
 * track wrote the whole balance to storage and the defaults of that day
 * shadowed the match from then on. The measurement was computed correctly
 * on every open and thrown away every time.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useListening } from '../useListening';
import { DEFAULT_LEVELS } from '../playbackTracks';
import { getJSON, remove, setJSON } from '../../../data/store';

const NOTE = 'note-under-test';
const KEY = `notes.${NOTE}.listening`;

/**
 * A take sung quietly, so the match has somewhere to move the tracks to.
 *
 * Every synthesized track moves by one factor, which is what keeps the
 * balance between them while the whole follows the take.
 */
const QUIET = {
  ...DEFAULT_LEVELS,
  melody: DEFAULT_LEVELS.melody * 0.4,
  chords: DEFAULT_LEVELS.chords * 0.4
};

/** `renderHook` and `unmount` are both async here — see useListening.test.ts. */
beforeEach(() => remove(KEY));

describe('a note nobody has balanced', () => {
  it('ACC-NOTES-216: follows a take measured after the note was opened', async () => {
    // The order this actually happens in. A take recorded before anything
    // measured its loudness opens with the flat defaults; toggling any track
    // writes the whole balance; the take is measured later, by a re-read or
    // by a newer build. The match then had nothing left to move, because the
    // defaults of that first day were sitting on top of it.
    const before = await renderHook(() => useListening(NOTE, DEFAULT_LEVELS));
    await act(() => before.result.current.setAudible('melody', true));
    await before.unmount();

    const after = await renderHook(() => useListening(NOTE, QUIET));
    expect(after.result.current.mix.melody).toBe(true);
    expect(after.result.current.levels.melody).toBeCloseTo(QUIET.melody, 6);
  });

  it('keeps nothing about levels in what it writes', async () => {
    const first = await renderHook(() => useListening(NOTE, QUIET));
    await act(() => first.result.current.setAudible('melody', true));
    const kept = getJSON<{ chosenLevels?: Record<string, number> }>(KEY);
    expect(kept?.chosenLevels).toEqual({});
  });
});

describe('a level the singer moved', () => {
  it('ACC-NOTES-217: wins, and leaves the other tracks following the take', async () => {
    const first = await renderHook(() => useListening(NOTE, QUIET));
    await act(() => first.result.current.setLevel('melody', 0.9));
    await first.unmount();

    const again = await renderHook(() => useListening(NOTE, QUIET));
    expect(again.result.current.levels.melody).toBe(0.9);
    // The chords were never touched, so they still sit where the take does.
    expect(again.result.current.levels.chords).toBeCloseTo(QUIET.chords, 6);
  });

  it('is what gets written down', async () => {
    const first = await renderHook(() => useListening(NOTE, QUIET));
    await act(() => first.result.current.setLevel('melody', 0.9));
    const kept = getJSON<{ chosenLevels?: Record<string, number> }>(KEY);
    expect(kept?.chosenLevels).toEqual({ melody: 0.9 });
  });
});

describe('a balance kept by an older install', () => {
  it('keeps what differs from the defaults and releases what does not', async () => {
    // Every level written, most of them untouched defaults — which is what
    // froze the match for every note that had ever been opened.
    setJSON(KEY, { levels: { ...DEFAULT_LEVELS, chords: 0.15 } });
    const { result } = await renderHook(() => useListening(NOTE, QUIET));
    // Moved by hand once, so it stays where it was put.
    expect(result.current.levels.chords).toBe(0.15);
    // Never moved, so the match takes it back.
    expect(result.current.levels.melody).toBeCloseTo(QUIET.melody, 6);
  });
});
