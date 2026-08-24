/**
 * INV-NOTES-125 — the beat, felt rather than heard.
 *
 * A click over a take is a click in the take: you hear it while listening to
 * what you sang, and on a phone speaker it wins. Felt instead, it keeps time
 * without taking any of the room the music is in.
 *
 * Booked ahead against the clock rather than fired when a position update
 * arrives. Updates land sixty times a second at best and unevenly, so a tap
 * driven by them would land wherever they did — which for a metronome is the
 * one thing that must not happen.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useHapticBeat } from '../useHapticBeat';

// Named `mock*` because a jest.mock factory is hoisted above every other
// declaration and may only close over variables spelled that way.
const mockImpact = jest.fn();
jest.mock('../../../specs/NativeHaptics', () => ({
  __esModule: true,
  default: { impact: (...args: unknown[]) => mockImpact(...args) }
}));

const CLICK = 60;
const DOWNBEAT = 72;

const beats = [
  { startMs: 0, midi: DOWNBEAT },
  { startMs: 500, midi: CLICK },
  { startMs: 1000, midi: CLICK },
  { startMs: 1500, midi: CLICK }
];

const play = (over: Record<string, unknown> = {}) =>
  renderHook(() =>
    useHapticBeat({
      beats,
      positionMs: 0,
      isPlaying: true,
      isOn: true,
      ...over
    })
  );

beforeEach(() => {
  jest.useFakeTimers();
  mockImpact.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('feeling the beat', () => {
  it('taps once per beat, as each one comes due', async () => {
    await play();
    expect(mockImpact).not.toHaveBeenCalled();

    await act(() => void jest.advanceTimersByTime(1600));
    expect(mockImpact).toHaveBeenCalledTimes(beats.length);
  });

  it('strikes the downbeat harder, as the sounded click accents it', async () => {
    await play();
    await act(() => void jest.advanceTimersByTime(600));
    // The first call is the downbeat and carries the heavier impact.
    expect(mockImpact.mock.calls[0][0]).toBeGreaterThan(mockImpact.mock.calls[1][0]);
  });

  it('does nothing at all while it is turned off', async () => {
    await play({ isOn: false });
    await act(() => void jest.advanceTimersByTime(2000));
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it('does nothing while nothing is playing', async () => {
    await play({ isPlaying: false });
    await act(() => void jest.advanceTimersByTime(2000));
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it('skips beats already gone by when playing starts partway in', async () => {
    // Scrubbed to the third beat. Firing the first two immediately would be
    // three taps at once, which reads as one beat rather than three.
    await play({ positionMs: 1000 });
    await act(() => void jest.advanceTimersByTime(600));
    expect(mockImpact).toHaveBeenCalledTimes(2);
  });

  it('books nothing once it stops', async () => {
    const view = await play();
    await act(() => void view.unmount());
    await act(() => void jest.advanceTimersByTime(2000));
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it('has nothing to fire on a take with no tempo', async () => {
    await renderHook(() =>
      useHapticBeat({ beats: [], positionMs: 0, isPlaying: true, isOn: true })
    );
    await act(() => void jest.advanceTimersByTime(2000));
    expect(mockImpact).not.toHaveBeenCalled();
  });
});
