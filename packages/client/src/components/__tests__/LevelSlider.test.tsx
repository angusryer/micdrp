/**
 * ACC-NOTES-251 / INV-NOTES-235 — a level follows the finger without
 * re-rendering what holds it.
 *
 * The whole point of this control is hearing the balance move while the
 * finger is still down, so it must report as it goes. What it must not do is
 * report on every frame: what it reports sets state, and on a note's page
 * that state is read beside the graph.
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';

import { LevelSlider } from '../LevelSlider';
import { ThemeProvider } from '../../theme';

/** A hundred points wide, so an x reads as a percentage. */
const WIDTH = 100;

const draw = async (onChange: (v: number) => void, value = 0.5) => {
  const view = await waitFor(() =>
    render(
      <GestureHandlerRootView>
        <ThemeProvider>
          <LevelSlider
            value={value}
            onChange={onChange}
            accessibilityLabel="Take level"
          />
        </ThemeProvider>
      </GestureHandlerRootView>
    )
  );
  // Nothing can be worked out from a control of no width, and the gesture is
  // rebuilt once the width is known — so this has to land before the drag.
  const onLayout = view.getByTestId('level-slider').props.onLayout as (
    e: { nativeEvent: { layout: { width: number; height: number } } }
  ) => void;
  await act(async () => {
    onLayout({ nativeEvent: { layout: { width: WIDTH, height: 40 } } });
  });
  return view;
};

/** A drag across the track, one event per frame, as a finger would make. */
const dragAcross = (xs: readonly number[]) =>
  fireGestureHandler(getByGestureTestId('level-slider-pan'), [
    { state: State.BEGAN, x: xs[0] },
    { state: State.ACTIVE, x: xs[0] },
    ...xs.slice(1).map((x) => ({ x })),
    { state: State.END, x: xs[xs.length - 1] }
  ]);

it('ACC-NOTES-251: a sweep is not one report a frame', async () => {
  const onChange = jest.fn();
  await draw(onChange);
  // Sixty frames across half the range — a second of a real sweep, and the
  // case a distance threshold would not have caught. The clock does not
  // advance between them here, so everything after the first touch is inside
  // one window.
  const xs = Array.from({ length: 60 }, (_, i) => 25 + i * (50 / 59));
  dragAcross(xs);

  expect(onChange.mock.calls.length).toBeLessThan(xs.length / 4);
});

it('ACC-NOTES-251: it is still heard moving while the finger is down', async () => {
  const onChange = jest.fn();
  await draw(onChange);
  const now = jest.spyOn(Date, 'now');
  // Each frame a full window later, which is what a slow drag looks like.
  let clock = 10_000;
  now.mockImplementation(() => (clock += 60));

  dragAcross([25, 35, 45, 55, 65, 75]);
  now.mockRestore();

  // Reported as it goes rather than only at the end.
  expect(onChange.mock.calls.length).toBeGreaterThan(2);
});

it('ACC-NOTES-251: lands on exactly where the finger left it', async () => {
  const onChange = jest.fn();
  await draw(onChange);
  dragAcross([50, 60, 70, 80]);
  const calls = onChange.mock.calls as [number][];
  expect(calls[calls.length - 1][0]).toBeCloseTo(0.8, 5);
});

it('ACC-NOTES-251: landing on the track moves it there at once', async () => {
  const onChange = jest.fn();
  await draw(onChange, 0.2);
  dragAcross([90]);
  const calls = onChange.mock.calls as [number][];
  expect(calls[0][0]).toBeCloseTo(0.9, 5);
});
