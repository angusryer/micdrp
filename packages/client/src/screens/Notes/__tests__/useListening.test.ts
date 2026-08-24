/**
 * INV-NOTES-114 — a note remembers how it was being listened to.
 *
 * Which tracks are on, how loud each sits and which register the chords play
 * in were component state, so they lasted exactly as long as the screen did.
 * Coming back to a note you had spent time balancing gave you the defaults
 * again, and the balance is often the point — a bass layer sitting under a
 * take at the right level is a thing you arrive at, not a thing you set once.
 *
 * Kept apart from the interpretation deliberately. That is what somebody made
 * of a take and can be frozen and named; how loud you like the chords is not
 * a reading of the music.
 *
 * `renderHook` and `unmount` are both async in this setup — await them, or an
 * act scope stays open and every test after this one reads a null hook.
 */
import { act, renderHook } from '@testing-library/react-native';

import { remove } from '../../../data/store';
import { useListening } from '../useListening';

const ONE = 'note-one';
const TWO = 'note-two';

beforeEach(() => {
  remove(`notes.${ONE}.listening`);
  remove(`notes.${TWO}.listening`);
});

describe('how a note is being listened to', () => {
  it('starts every note at the defaults', async () => {
    const { result } = await renderHook(() => useListening(ONE));
    expect(result.current.mix).toBeTruthy();
    expect(result.current.chordOctaves).toBe(1);
  });

  it('remembers a track turned off', async () => {
    const first = await renderHook(() => useListening(ONE));
    await act(() => first.result.current.setAudible('chords', false));
    await first.unmount();

    const again = await renderHook(() => useListening(ONE));
    expect(again.result.current.mix.chords).toBe(false);
  });

  it('remembers a level and a register', async () => {
    const first = await renderHook(() => useListening(ONE));
    await act(() => {
      first.result.current.setLevel('take', 0.3);
      first.result.current.setChordOctaves(2);
    });
    await first.unmount();

    const again = await renderHook(() => useListening(ONE));
    expect(again.result.current.levels.take).toBeCloseTo(0.3, 6);
    expect(again.result.current.chordOctaves).toBe(2);
  });

  it("keeps one note's balance to itself", async () => {
    const first = await renderHook(() => useListening(ONE));
    await act(() => first.result.current.setChordOctaves(3));
    await first.unmount();

    const other = await renderHook(() => useListening(TWO));
    expect(other.result.current.chordOctaves).toBe(1);
  });

  it('falls back to the defaults for anything kept before it existed', async () => {
    // A note balanced before a track existed has no setting for it, and
    // should get that track's default rather than nothing at all.
    const first = await renderHook(() => useListening(ONE));
    await act(() => first.result.current.setAudible('take', false));
    await first.unmount();

    const again = await renderHook(() => useListening(ONE));
    expect(again.result.current.mix.take).toBe(false);
    expect(typeof again.result.current.levels.take).toBe('number');
  });

  it('keeps nothing for a screen with no note to keep it against', async () => {
    // The dogfood player has no note. It still works; it just forgets.
    const { result } = await renderHook(() => useListening(null));
    await act(() => result.current.setChordOctaves(3));
    expect(result.current.chordOctaves).toBe(3);
  });
});
