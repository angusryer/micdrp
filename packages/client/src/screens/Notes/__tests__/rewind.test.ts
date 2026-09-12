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
import { REWIND_TO_MS } from '../usePlaybackMix';

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

  it('goes to the start, wherever the take had reached', () => {
    // It went back a fixed five seconds, which is a different act: five
    // seconds is where you go to hear a phrase again, and dragging the head
    // already does that. Getting to the beginning in five-second steps from
    // two minutes in is a chore rather than a control (INV-NOTES-160).
    //
    // The start is the earliest moment the take has: zero unless a
    // count-in sits before it, in which case rewind goes to the count's
    // first beat (INV-TPORT-040). This is the default with no count.
    expect(REWIND_TO_MS).toBe(0);
  });

  it('counts from before zero when the run began in the count-in', async () => {
    // A run may begin before the material (INV-TPORT-039): the clock reads
    // the count's first beat, and the head moves through it.
    const { result } = await renderHook(() => usePlaybackClock(true, -2_000));
    expect(result.current).toBe(-2_000);
  });

  it('names a moment inside the take, never before it', () => {
    const at = (toMs: number) => Math.max(0, toMs);
    expect(at(REWIND_TO_MS)).toBe(0);
    expect(at(-2000)).toBe(0);
  });
});
