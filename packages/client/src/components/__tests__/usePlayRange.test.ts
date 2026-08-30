/**
 * INV-NOTES-178, INV-NOTES-179 — marking a stretch plays it, and moving an
 * end of it does not.
 */
import { act, renderHook } from '@testing-library/react-native';

import { LEAD_IN_MS, MIN_RANGE_MS } from '../playRange';
import { usePlayRange } from '../usePlayRange';

const BOUNDS = { startMs: 0, endMs: 30000 };

const aTransport = () => ({
  play: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve())
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('marking a stretch', () => {
  it('plays it once, from its start', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, BOUNDS)
    );
    await act(async () => {
      result.current.markAround(5000, 6000);
    });
    expect(transport.play).toHaveBeenCalledTimes(1);
    expect(transport.play).toHaveBeenCalledWith(5000 - LEAD_IN_MS);
    expect(result.current.isPlaying).toBe(true);
  });

  it('falls silent at its end and not before', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, BOUNDS)
    );
    await act(async () => {
      result.current.markAround(5000, 6000);
    });
    const runsFor = result.current.range!.toMs - result.current.range!.fromMs;
    await act(async () => {
      jest.advanceTimersByTime(runsFor - 1);
    });
    expect(transport.stop).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(transport.stop).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
  });

  it('marks nothing where there is not enough to play', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, { startMs: 0, endMs: 50 })
    );
    await act(async () => {
      result.current.markAround(0, 10);
    });
    expect(result.current.range).toBeNull();
    expect(transport.play).not.toHaveBeenCalled();
  });
});

describe('moving an end of it', () => {
  it('moves only that end, and stays quiet', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, BOUNDS)
    );
    await act(async () => {
      result.current.markAround(5000, 6000);
    });
    const before = result.current.range!;
    await act(async () => {
      result.current.moveEnd('from', 4000);
    });
    expect(result.current.range).toEqual({ fromMs: 4000, toMs: before.toMs });
    expect(transport.play).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it('stops one end against the other', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, BOUNDS)
    );
    await act(async () => {
      result.current.markAround(5000, 6000);
    });
    const end = result.current.range!.toMs;
    await act(async () => {
      result.current.moveEnd('from', 99000);
    });
    expect(result.current.range!.toMs).toBe(end);
    expect(result.current.range!.fromMs).toBe(end - MIN_RANGE_MS);
  });

  it('does not let a stretch stop the playback that replaced it', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, BOUNDS)
    );
    await act(async () => {
      result.current.markAround(5000, 6000);
    });
    await act(async () => {
      result.current.moveEnd('to', 20000);
    });
    // The first stretch's timer would have fired around here.
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(transport.stop).not.toHaveBeenCalled();
  });
});

describe('playing it again', () => {
  it('starts from the start the stretch now has', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, BOUNDS)
    );
    await act(async () => {
      result.current.markAround(5000, 6000);
    });
    await act(async () => {
      result.current.moveEnd('from', 4000);
    });
    await act(async () => {
      result.current.playRange();
    });
    expect(transport.play).toHaveBeenLastCalledWith(4000);
  });

  it('has nothing to play once the mark is taken away', async () => {
    const transport = aTransport();
    const { result } = await renderHook(() =>
      usePlayRange(transport, BOUNDS)
    );
    await act(async () => {
      result.current.markAround(5000, 6000);
    });
    await act(async () => {
      result.current.clear();
    });
    expect(result.current.range).toBeNull();
    await act(async () => {
      result.current.playRange();
    });
    expect(transport.play).toHaveBeenCalledTimes(1);
  });
});
