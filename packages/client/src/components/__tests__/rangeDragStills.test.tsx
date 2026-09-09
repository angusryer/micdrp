/**
 * ACC-NOTES-250 / INV-NOTES-235 — dragging an end of a stretch leaves
 * everything around it still.
 *
 * The existing test asserts the drag is written down once, which is the cause.
 * This asserts the effect, which is the thing that was actually wrong: the
 * page holding the stretch reads it beside the graph, so a write per frame was
 * a reconciliation of the graph per frame. Counting renders is the only way to
 * see that — a test of the callback alone would pass on code that still
 * re-rendered.
 */
import React, { useCallback, useState } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';

import { PlayRangeOverlay } from '../PlayRangeOverlay';
import { moveEdge, type PlayRange, type RangeEdge } from '../playRange';
import type { TimeAxis } from '../melodyScale';

/** One pixel per millisecond, so a position reads as the moment it is. */
const AXIS: TimeAxis = { t0: 0, span: 10000, pad: 0, innerW: 10000, pxPerMs: 1 };
const BOUNDS = { startMs: 0, endMs: 10000 };

let renders = 0;

/**
 * A page that holds the stretch, as the note's own does.
 *
 * The point of the harness is that the stretch is state here, read on every
 * render — the same shape as the graph section, where that state decides what
 * is drawn over the take.
 */
function Page(): React.JSX.Element {
  renders += 1;
  const [range, setRange] = useState<PlayRange | null>({
    fromMs: 2000,
    toMs: 5000
  });
  const [, setSilenced] = useState(0);

  const onGrab = useCallback(() => setSilenced((n) => n + 1), []);
  const onMoveEnd = useCallback(
    (edge: RangeEdge, toMs: number) =>
      setRange((was) => (was ? moveEdge(was, edge, toMs, BOUNDS) : was)),
    []
  );

  return (
    <GestureHandlerRootView>
      <PlayRangeOverlay
        range={range}
        timeAxis={AXIS}
        height={100}
        shade="#111"
        fromColor="#0f0"
        toColor="#f0f"
        controlColor="#fff"
        onGrab={onGrab}
        onMoveEnd={onMoveEnd}
        onPlay={() => undefined}
        isPlaying={false}
      />
    </GestureHandlerRootView>
  );
}

/** Thirty frames of movement, which is half a second of a real drag. */
const FRAMES = Array.from({ length: 30 }, (_, i) => ({
  translationX: (i + 1) * 10
}));

beforeEach(() => {
  renders = 0;
});

it('ACC-NOTES-250: thirty frames of drag reconcile the page no more than twice', async () => {
  await waitFor(() => render(<Page />));
  const settled = renders;

  await act(async () => {
    fireGestureHandler(getByGestureTestId('play-range-to-pan'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 0 },
      ...FRAMES,
      { state: State.END, translationX: 300 }
    ]);
  });

  // One for falling silent as the finger lands, one for the stretch it
  // settled on. Never one per frame, which is what this used to be — and
  // what dragged the whole graph through React thirty times over.
  expect(renders - settled).toBeLessThanOrEqual(2);
});

it('ACC-NOTES-250: and the stretch ends up where the finger left it', async () => {
  const view = await waitFor(() => render(<Page />));

  await act(async () => {
    fireGestureHandler(getByGestureTestId('play-range-to-pan'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 0 },
      ...FRAMES,
      { state: State.END, translationX: 300 }
    ]);
  });

  // 5000 + the last frame's 300, drawn from the committed stretch.
  const shade = view.getByTestId('play-range-shade');
  expect(shade.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ width: 3300 })])
  );
});
