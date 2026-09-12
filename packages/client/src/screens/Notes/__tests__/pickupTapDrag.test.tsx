/**
 * INV-NOTES-269 — a tap opens what the count is made of; a drag moves it.
 *
 * One thing under the finger answering two questions, so the test that
 * matters is that neither gesture can trigger the other: a tap that moved
 * the count would put it somewhere nobody chose, and a drag that opened a
 * sheet would cover the graph the count was being placed against.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';

import { ThemeProvider } from '../../../theme';
import type { TimeAxis } from '../../../components/melodyScale';
import { PickupBlock } from '../PickupBlock';

const AXIS: TimeAxis = { t0: -2000, span: 10000, pad: 0, innerW: 10000, pxPerMs: 1 };

const show = (onOpen: jest.Mock, onSettled: jest.Mock) =>
  render(
    <GestureHandlerRootView>
      <ThemeProvider>
        <PickupBlock
          fromMs={-2000}
          endMs={0}
          timeAxis={AXIS}
          height={200}
          onOpen={onOpen}
          onSettled={onSettled}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );

describe('a touch on the count-in', () => {
  it('opens what it is made of when it does not travel', async () => {
    const onOpen = jest.fn();
    const onSettled = jest.fn();
    await show(onOpen, onSettled);
    fireGestureHandler(getByGestureTestId('pickup-block-tap'), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END }
    ]);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // And moves nothing: the count is where it was.
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('moves it when it travels, and opens nothing', async () => {
    const onOpen = jest.fn();
    const onSettled = jest.fn();
    await show(onOpen, onSettled);
    fireGestureHandler(getByGestureTestId('pickup-block-pan'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 0 },
      { translationX: 400 },
      { translationX: 800 },
      { state: State.END, translationX: 800 }
    ]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

});
