/**
 * Dragging a bar line — INV-NOTES-028 / INT-NOTES-012.
 *
 * The readout followed the finger while the line stayed where it was, so the
 * one thing being placed was the one thing that did not move and the gesture
 * read as unregistered. These tests pin the line to the finger: it is drawn at
 * the step it would land on, it stops against its neighbour, and the drop
 * commits the step it was last drawn at.
 *
 * The model does the arithmetic here rather than a fake, so a ruler that
 * paints one step and drops another cannot pass.
 *
 * Anything asserted mid-drag needs a controller: `fireGestureHandler` runs the
 * whole gesture to its end, by which point the line is wherever the drop left
 * it and the question being asked has gone.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  createGestureController,
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';
import React from 'react';
import { StyleSheet } from 'react-native';

import type { BarLayout } from 'logic';

import { LOUPE_HEIGHT } from '../../../components/DragLoupe';
import { ThemeProvider } from '../../../theme';
import { BarRuler } from '../BarRuler';
import { barHandles, dropAtX, stepAtX } from '../barRulerModel';

/** Four sixteenths to a beat, 4px to a sixteenth, three bars of four. */
const LAYOUT: BarLayout = { lines: [0, 16, 32], stepsPerBeat: 4, isCompound: false };
const GEOM = { originX: 0, stepWidth: 4 };
const TOTAL_STEPS = 48;
const GRAB_HALF = 22;

const handlers = () => ({
  onMove: jest.fn(),
  onSplit: jest.fn(),
  onMerge: jest.fn()
});

const renderRuler = (props: ReturnType<typeof handlers>) =>
  waitFor(() =>
    render(
      <GestureHandlerRootView>
        <ThemeProvider>
          <BarRuler
            handles={barHandles(LAYOUT, GEOM)}
            width={200}
            height={150}
            stepAtX={(x) => stepAtX(x, GEOM)}
            dropAt={(lineIndex, x) =>
              dropAtX(LAYOUT, TOTAL_STEPS, GEOM, lineIndex, x)
            }
            {...props}
          />
        </ThemeProvider>
      </GestureHandlerRootView>
    )
  );

/** Where the line itself is drawn, undoing the grab area around it. */
const lineX = (handle: { props: { style?: unknown } }): number =>
  (StyleSheet.flatten(handle.props.style) as { left: number }).left + GRAB_HALF;

/** Hold line 1 partway through a drag of `translationX` pixels. */
const TOUCH_Y = 40;
const dragTo = async (translationX: number) => {
  const drag = createGestureController('bar-line-pan-1');
  await act(async () => {
    drag.begin({ translationX: 0, translationY: 0, y: TOUCH_Y });
    drag.activate({ translationX: 0, translationY: 0, y: TOUCH_Y });
    drag.update({ translationX, translationY: 0, y: TOUCH_Y });
  });
};

describe('BarRuler drag', () => {
  it('moves the line with the finger while the drag is live', async () => {
    const view = await renderRuler(handlers());

    // Line 1 rests at x=64. Sixteen pixels left is four sixteenths back.
    await dragTo(-16);

    expect(lineX(view.getByTestId('bar-line-1'))).toBe(48);
    expect(view.getByTestId('drag-loupe')).toBeTruthy();
  });

  it('leaves the lines that are not being dragged where they are', async () => {
    const view = await renderRuler(handlers());

    await dragTo(-16);

    expect(lineX(view.getByTestId('bar-line-0'))).toBe(0);
    expect(lineX(view.getByTestId('bar-line-2'))).toBe(128);
  });

  it('stops the line against its neighbour rather than crossing it', async () => {
    const view = await renderRuler(handlers());

    await dragTo(400);

    // Step 31, one short of the line at 32.
    expect(lineX(view.getByTestId('bar-line-1'))).toBe(124);
  });

  it('keeps the readout clear of the finger, above the short ruler', async () => {
    const view = await renderRuler(handlers());

    await dragTo(-16);

    // The ruler is 150 tall — too short to hold the loupe beside a thumb.
    // It must ride above the finger, off the strip if need be, never level
    // with the hand (INV-NOTES-025).
    const loupe = StyleSheet.flatten(
      view.getByTestId('drag-loupe').props.style
    ) as { top: number };
    expect(loupe.top + LOUPE_HEIGHT).toBeLessThan(TOUCH_Y);
  });

  it('commits the step the line was last drawn at', async () => {
    const props = handlers();
    await renderRuler(props);

    await act(async () =>
      fireGestureHandler(getByGestureTestId('bar-line-pan-1'), [
        { translationX: 0, translationY: 40 },
        { translationX: -16, translationY: 40 }
      ])
    );

    expect(props.onMove).toHaveBeenCalledWith(1, 12);
  });

  it('commits a step the layout will accept even when dragged past a line', async () => {
    const props = handlers();
    await renderRuler(props);

    await act(async () =>
      fireGestureHandler(getByGestureTestId('bar-line-pan-1'), [
        { translationX: 0, translationY: 40 },
        { translationX: 400, translationY: 40 }
      ])
    );

    // Not 116, which moveBarLine would refuse, leaving the line snapped back.
    expect(props.onMove).toHaveBeenCalledWith(1, 31);
  });
});
