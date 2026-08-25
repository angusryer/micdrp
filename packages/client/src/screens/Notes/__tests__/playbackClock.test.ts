/**
 * INV-NOTES-136 — the playhead reads the engine's clock.
 *
 * This was `Date.now()` on a timer, justified by a BufferSourceNode reporting
 * no position — which stopped being true when the take became a voice on the
 * engine. What was left was a third clock approximating the one the audio
 * actually runs on, drifting from it over a long take.
 *
 * `renderHook` is async in this setup — await it.
 */
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  // Required in the factory, not closed over: a factory runs before this
  // module's own bindings exist.
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { usePlaybackClock } from '../usePlaybackClock';
import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';

beforeEach(() => {
  jest.useFakeTimers();
  resetSynthDouble();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Move the engine's clock on, and let the counter notice. */
const engineReaches = async (ms: number) => {
  synth.nowMs.mockReturnValue(ms);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
};

describe('how far into a running take we are', () => {
  it('counts by the engine’s clock, not by time spent waiting', async () => {
    const { result } = await renderHook(() => usePlaybackClock(true, 0));
    // The wall clock advanced a second; the engine says two. The engine wins:
    // it is the thing the audio is actually running on.
    await engineReaches(2000);
    expect(result.current).toBe(2000);
  });

  it('counts from where a resumed take began', async () => {
    // The counter names a moment in the take, and after a rewind that moment
    // is not the start (INV-NOTES-069).
    const { result } = await renderHook(() => usePlaybackClock(true, 12_000));
    await engineReaches(3000);
    expect(result.current).toBe(15_000);
  });

  it('never runs backwards when the engine is restarted under it', async () => {
    // A stopped engine reads zero, which is behind where the take was.
    const { result } = await renderHook(() => usePlaybackClock(true, 5000));
    await engineReaches(0);
    expect(result.current).toBe(5000);
  });

  it('reads where the take begins while nothing is running', async () => {
    const { result } = await renderHook(() => usePlaybackClock(false, 7000));
    await engineReaches(30_000);
    expect(result.current).toBe(7000);
  });
});
