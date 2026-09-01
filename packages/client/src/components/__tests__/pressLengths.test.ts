/**
 * INV-NOTES-192 — every length of press means something.
 *
 * The tap gave up at 300ms and the hold did not begin until 400, so a press
 * released between the two did nothing at all — not on a note, not on a line,
 * not on empty space. Nothing reported it, so it read as a missed press.
 */
import { renderHook } from '@testing-library/react-native';

import { useGraphChoose } from '../useGraphChoose';
import type { SettledOptions } from '../graphGestureOptions';

/** The least a graph can be, since these assertions are about time only. */
const bareGraph = (): SettledOptions =>
  ({
    tones: [],
    bars: [],
    notes: [],
    layerNotes: [],
    hits: [],
    beats: [],
    laneHeight: 10,
    originX: 0,
    stepWidth: 10,
    selection: [],
    snapToGrid: true,
    onSelect: jest.fn(),
    onMoveBar: jest.fn(),
    onMoveTone: jest.fn(),
    onMoveNote: jest.fn(),
    onAddBar: jest.fn()
  }) as unknown as SettledOptions;

describe('the boundary between choosing and holding', () => {
  it('is the same number in both gestures, so no press falls between', async () => {
    const { result } = await renderHook(() => useGraphChoose(bareGraph()));
    const tap = result.current.tap as unknown as {
      config: { maxDurationMs?: number };
    };
    const add = result.current.add as unknown as {
      config: { minDurationMs?: number };
    };
    expect(tap.config.maxDurationMs).toBeDefined();
    expect(add.config.minDurationMs).toBeDefined();
    expect(tap.config.maxDurationMs).toBe(add.config.minDurationMs);
  });

  it('leaves a press of any length with something to mean', async () => {
    const { result } = await renderHook(() => useGraphChoose(bareGraph()));
    const boundary = (
      result.current.add as unknown as { config: { minDurationMs: number } }
    ).config.minDurationMs;
    const longest = (
      result.current.tap as unknown as { config: { maxDurationMs: number } }
    ).config.maxDurationMs;
    // Every duration is on one side or the other, with nothing in between.
    for (const heldMs of [0, 120, 299, 300, 350, 399, 400, 401, 900]) {
      expect(heldMs <= longest || heldMs >= boundary).toBe(true);
    }
  });
});
