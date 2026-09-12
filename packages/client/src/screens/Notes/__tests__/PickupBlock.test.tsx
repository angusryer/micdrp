/**
 * INV-NOTES-268 — the count-in is a block that can be dragged onto the
 * singing.
 *
 * Driven through the real gesture rather than by asserting the shape of
 * one: what matters is where the count ends up after a finger has moved
 * it, and that the frame after the commit draws it there rather than a
 * second drag further on (INV-NOTES-235).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';

import { ThemeProvider } from '../../../theme';
import { msForX, type TimeAxis } from '../../../components/melodyScale';
import { PickupBlock } from '../PickupBlock';

/** One pixel per millisecond, from two seconds before the take. */
const AXIS: TimeAxis = { t0: -2000, span: 10000, pad: 0, innerW: 10000, pxPerMs: 1 };

const show = (onSettled: jest.Mock, endMs = 0) =>
  render(
    <GestureHandlerRootView>
      <ThemeProvider>
        <PickupBlock
          fromMs={-2000}
          endMs={endMs}
          timeAxis={AXIS}
          height={200}
          onSettled={onSettled}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );

/**
 * A drag of `by` pixels, begun on the block and released there.
 *
 * The last move is at the finishing position, as a real finger's is: the
 * release reads where the drag got to, not where the event that ends it
 * claims to be.
 */
const dragBy = (by: number) =>
  fireGestureHandler(getByGestureTestId('pickup-block-pan'), [
    { state: State.BEGAN, translationX: 0 },
    { state: State.ACTIVE, translationX: 0 },
    { translationX: by / 3 },
    { translationX: (by * 2) / 3 },
    { translationX: by },
    { state: State.END, translationX: by }
  ]);

describe('the count-in block', () => {
  it('reports where its end came to rest, in ms', async () => {
    const onSettled = jest.fn();
    await show(onSettled);
    // The block spans -2000..0, so its end sits at x = 2000. Dragged
    // 1200px right, the count now ends 1200ms later.
    dragBy(1200);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(msForX(AXIS, onSettled.mock.calls[0][0] as number)).toBeCloseTo(1200, 6);
  });

  it('says where it landed once, however many frames the drag took', async () => {
    // Once, on release (INV-NOTES-235). A count written down per frame
    // would re-derive the take — and move the window under the finger —
    // on every frame of the drag.
    const onSettled = jest.fn();
    await show(onSettled);
    dragBy(900);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('can be dragged back towards the recording', async () => {
    const onSettled = jest.fn();
    await show(onSettled, 1500);
    dragBy(-500);
    expect(msForX(AXIS, onSettled.mock.calls[0][0] as number)).toBeCloseTo(1000, 6);
  });

  it('draws nothing for a count with no length', async () => {
    const onSettled = jest.fn();
    const shown = await render(
      <GestureHandlerRootView>
        <ThemeProvider>
          <PickupBlock
            fromMs={0}
            endMs={0}
            timeAxis={AXIS}
            height={200}
            onSettled={onSettled}
          />
        </ThemeProvider>
      </GestureHandlerRootView>
    );
    expect(shown.queryByTestId('pickup-block')).toBeNull();
  });
});
