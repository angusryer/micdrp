/**
 * The melody control is a toggle — INV-NOTES-031.
 *
 * What these pin is the way out: the press that starts the melody stops it,
 * it stops itself when the melody runs out, a tap that takes the same voice
 * ends it rather than leaving the control claiming to play, and a different
 * reading silences the one already sounding.
 *
 * `renderHook` is async in this setup — await it and any rerender.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { TargetNote } from 'logic';

const mockPlayed: TargetNote[][] = [];
const mockStopped = jest.fn();

jest.mock('../../../audio/referenceTone', () => ({
  createReferenceTonePlayer: () => ({
    play: (notes: TargetNote[]) => mockPlayed.push([...notes]),
    stop: () => {
      mockStopped();
    },
    setLevel: jest.fn()
  })
}));

import { useTonePreview } from '../useTonePreview';

/** Two seconds of melody, so the end is a clock the test can advance to. */
const MELODY: TargetNote[] = [
  { midi: 60, startMs: 0, endMs: 1000 },
  { midi: 62, startMs: 1000, endMs: 2000 }
];

describe('useTonePreview', () => {
  beforeEach(() => {
    mockPlayed.length = 0;
    mockStopped.mockClear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('sounds the melody on the first press and says so', async () => {
    const { result } = await renderHook(() => useTonePreview(MELODY));
    expect(result.current.isPlaying).toBe(false);

    await act(async () => result.current.play());
    expect(mockPlayed).toEqual([MELODY]);
    expect(result.current.isPlaying).toBe(true);
  });

  it('stops on the second press and schedules nothing new', async () => {
    const { result } = await renderHook(() => useTonePreview(MELODY));
    await act(async () => result.current.play());
    await act(async () => result.current.stop());

    expect(mockStopped).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    expect(mockPlayed).toHaveLength(1);
  });

  it('offers play again once the melody has run out, with no press', async () => {
    const { result } = await renderHook(() => useTonePreview(MELODY));
    await act(async () => result.current.play());
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('will not claim to play a melody a tapped note cut off', async () => {
    const { result } = await renderHook(() => useTonePreview(MELODY));
    await act(async () => result.current.play());
    await act(async () =>
      result.current.playTones([{ midi: 67, startMs: 0, endMs: 700 }])
    );
    expect(result.current.isPlaying).toBe(false);
  });

  it('has nothing to sound when the take has no melody', async () => {
    const { result } = await renderHook(() => useTonePreview([]));
    await act(async () => result.current.play());
    expect(mockPlayed).toEqual([]);
    expect(result.current.isPlaying).toBe(false);
  });

  it('silences the melody when the reading beside it changes', async () => {
    const { result, rerender } = await renderHook(
      (melody: TargetNote[]) => useTonePreview(melody),
      { initialProps: MELODY }
    );
    await act(async () => result.current.play());
    mockStopped.mockClear();

    // The written reading is a different melody, so what is sounding is no
    // longer what the control means.
    await act(async () =>
      rerender([{ midi: 60, startMs: 0, endMs: 500 }] as TargetNote[])
    );
    expect(mockStopped).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
  });

  it('leaves nothing sounding when the screen goes away', async () => {
    const { result, unmount } = await renderHook(() => useTonePreview(MELODY));
    await act(async () => result.current.play());
    mockStopped.mockClear();
    // Awaited, like the render: unmount is async in this setup too.
    await unmount();
    expect(mockStopped).toHaveBeenCalled();
  });
});
