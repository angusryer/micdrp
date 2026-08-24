/**
 * INV-NOTES-056 — a drag is measured from where it was grabbed.
 *
 * The regression this pins is a feedback loop rather than a wrong formula:
 * the translation a pan reports is cumulative from touch-down, and the graph
 * was adding it to the line's *current* position, which the earlier part of
 * the same drag had already moved. Every pixel was counted again on each
 * update and the line outran the thumb.
 *
 * So the test has to move the object between updates, exactly as the screen
 * does — a single update proves nothing, and that is why the bug shipped.
 *
 * `renderHook` is async in this setup, as the interpretation suite notes.
 */
import { renderHook } from '@testing-library/react-native';

import { useGraphGestures } from '../useGraphGestures';
import type { BarHandlePoint, Selection } from '../graphSelection';

const ORIGIN_X = 0;
const STEP_WIDTH = 10;

/**
 * The pan's registered callbacks, out of the composed gesture the hook
 * returns. They live under `handlers`; the same names on the gesture itself
 * are the builder methods that put them there.
 */
function panOf(gesture: unknown): {
  onUpdate: (e: unknown) => void;
  onTouchesDown: (e: unknown, s: unknown) => void;
} {
  const composed = gesture as { toGestureArray: () => unknown[] };
  const found = composed
    .toGestureArray()
    .find(
      (g) => (g as { config?: { testId?: string } }).config?.testId === 'graph-drag'
    );
  return (found as { handlers: never }).handlers;
}

describe('dragging what is chosen', () => {
  it('keeps a bar line under the thumb across a whole drag', async () => {
    const selection: Selection = { kind: 'barLine', lineIndex: 1 };
    // The line as the screen would redraw it: index 1 starts at step 10.
    let bars: BarHandlePoint[] = [
      { lineIndex: 0, x: 0 },
      { lineIndex: 1, x: 100 }
    ];
    const moves: number[] = [];

    const { result, rerender } = await renderHook(() =>
      useGraphGestures({
        tones: [],
        bars,
        notes: [],
        laneHeight: 10,
        originX: ORIGIN_X,
        stepWidth: STEP_WIDTH,
        selection,
        onSelect: jest.fn(),
        onMoveBar: (_line, step) => {
          moves.push(step);
          // What the screen does: the arrangement changes, so the handle is
          // redrawn where the line now is. This is the feedback path.
          bars = [
            { lineIndex: 0, x: 0 },
            { lineIndex: 1, x: ORIGIN_X + step * STEP_WIDTH }
          ];
        },
        onMoveTone: jest.fn(),
        onMoveNote: jest.fn(),
        onAddBar: jest.fn()
      })
    );

    panOf(result.current).onTouchesDown(
      { changedTouches: [{ x: 100, y: 40 }] },
      { activate: jest.fn(), fail: jest.fn() }
    );

    // One continuous drag of 30px right, reported cumulatively as a real pan
    // reports it. The gesture is taken fresh each time, so each update sees
    // the line where the previous one left it — the feedback path itself.
    for (const translationX of [10, 20, 30]) {
      panOf(result.current).onUpdate({ translationX, translationY: 0 });
      await rerender({});
    }

    // Grabbed at x=100 (step 10) and moved 30px, which is 3 steps.
    expect(moves[moves.length - 1]).toBe(13);
    // And never overshot on the way: 100+10, 100+20, 100+30.
    expect(moves).toEqual([11, 12, 13]);
  });
});

describe('INV-NOTES-092: tapping the chosen thing puts it down', () => {
  const NOTES = [
    { x: 10, y: 20, width: 30, height: 6, cy: 23, midi: 60 }
  ] as never;

  const chooseAt = async (selection: Selection | null) => {
    const chosen: (Selection | null)[] = [];
    const { result } = await renderHook(() =>
      useGraphGestures({
        tones: [],
        bars: [],
        notes: NOTES,
        laneHeight: 10,
        originX: 0,
        stepWidth: 10,
        selection,
        onSelect: (next) => chosen.push(next),
        onMoveBar: jest.fn(),
        onMoveTone: jest.fn(),
        onMoveNote: jest.fn(),
        onAddBar: jest.fn()
      })
    );
    const composed = result.current as { toGestureArray: () => unknown[] };
    const tap = composed
      .toGestureArray()
      .find(
        (g) =>
          (g as { config?: { testId?: string } }).config?.testId ===
          'graph-select'
      ) as { handlers: { onEnd: (e: unknown) => void } };
    tap.handlers.onEnd({ x: 20, y: 23 });
    return chosen;
  };

  it('chooses it when nothing is chosen', async () => {
    expect(await chooseAt(null)).toEqual([{ kind: 'melodyNote', index: 0 }]);
  });

  it('puts it down when it is the one already chosen', async () => {
    // Otherwise letting go means hunting for empty space on a graph that has
    // very little of it.
    expect(await chooseAt({ kind: 'melodyNote', index: 0 })).toEqual([null]);
  });

  it('takes the place of a different thing that was chosen', async () => {
    expect(await chooseAt({ kind: 'barLine', lineIndex: 2 })).toEqual([
      { kind: 'melodyNote', index: 0 }
    ]);
  });
});
