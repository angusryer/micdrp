/**
 * The take's clock at unit level — INV-NOTES-016.
 *
 * The card test proves the line is there and reads right; these two prove the
 * parts it is made of: a clock that only runs while the take does, and a
 * formatter that never reports more take than there was.
 */
import { act, renderHook } from '@testing-library/react-native';

import { formatPlaybackCounter } from '../noteCardFormat';
import { usePlaybackClock } from '../usePlaybackClock';

describe('formatPlaybackCounter', () => {
  it('is the take length alone when nothing is playing', () => {
    expect(formatPlaybackCounter(12_000, null)).toBe('0:12');
  });

  it('counts the position against the length while playing', () => {
    expect(formatPlaybackCounter(72_000, 3_400)).toBe('0:03 / 1:12');
  });

  it('never reports more take than there was', () => {
    expect(formatPlaybackCounter(12_000, 99_000)).toBe('0:12 / 0:12');
    expect(formatPlaybackCounter(12_000, -5)).toBe('0:00 / 0:12');
  });
});

describe('usePlaybackClock', () => {
  // setImmediate stays real: RNTL flushes its micro-tasks through it, and a
  // faked one deadlocks every await below.
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  const clock = (running: boolean) =>
    renderHook(
      (props: { running: boolean }) => usePlaybackClock(props.running),
      { initialProps: { running } }
    );

  const tick = (ms: number) =>
    act(async () => {
      jest.advanceTimersByTime(ms);
    });

  it('stays at 0 while nothing is playing', async () => {
    const { result } = await clock(false);

    await tick(5_000);

    expect(result.current).toBe(0);
  });

  it('counts up from the moment the take starts', async () => {
    const { result, rerender } = await clock(false);

    await rerender({ running: true });
    await tick(3_000);

    expect(result.current).toBe(3_000);
  });

  it('goes back to 0 when the take stops', async () => {
    const { result, rerender } = await clock(true);

    await tick(3_000);
    await rerender({ running: false });

    expect(result.current).toBe(0);
  });
});
