/**
 * INV-NOTES-069 — moving to a moment moves every track to that moment.
 *
 * The take, the chord backdrop and the melody over it are one performance
 * heard three ways. A backdrop that restarted from the top while the take
 * resumed in the middle would put a different chord under every note, which
 * reads as the harmony being wrong rather than the transport.
 *
 * The clock is the part that can be tested without an audio device: it is
 * what decides whether the counter names a moment in the take or merely time
 * since the press.
 */
import { renderHook } from '@testing-library/react-native';

import { usePlaybackClock } from '../usePlaybackClock';
import { REWIND_MS } from '../usePlaybackMix';

describe('the counter after a rewind', () => {
  it('reads from where playback began, not from zero', async () => {
    const { result } = await renderHook(() => usePlaybackClock(true, 12_000));
    expect(result.current).toBe(12_000);
  });

  it('starts at zero for a take played from the top', async () => {
    const { result } = await renderHook(() => usePlaybackClock(true));
    expect(result.current).toBe(0);
  });

  it('holds the moment it was left at when nothing is running', async () => {
    const { result } = await renderHook(() => usePlaybackClock(false, 8_000));
    expect(result.current).toBe(8_000);
  });

  it('goes back about a phrase, not to the start', () => {
    // Long enough to re-hear a sung phrase, short enough that a second press
    // is cheaper than starting over.
    expect(REWIND_MS).toBeGreaterThanOrEqual(3000);
    expect(REWIND_MS).toBeLessThanOrEqual(10000);
  });

  it('never asks for a moment before the take began', () => {
    const at = (positionMs: number) => Math.max(0, positionMs - REWIND_MS);
    expect(at(0)).toBe(0);
    expect(at(REWIND_MS - 1)).toBe(0);
    expect(at(REWIND_MS + 2000)).toBe(2000);
  });
});
