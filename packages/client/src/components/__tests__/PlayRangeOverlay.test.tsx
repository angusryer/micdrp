/**
 * INV-NOTES-179 — the stretch's two ends and its control, on their own.
 *
 * The overlay is deliberately ignorant of what the stretch was marked around
 * and of what plays it, so these render it against a bare time axis.
 */
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';

import { PlayRangeOverlay } from '../PlayRangeOverlay';
import type { TimeAxis } from '../melodyScale';

/** One pixel per millisecond, so a position reads as the moment it is. */
const AXIS: TimeAxis = {
  t0: 0,
  span: 10000,
  pad: 0,
  innerW: 10000,
  pxPerMs: 1
};

const draw = (
  props: Partial<React.ComponentProps<typeof PlayRangeOverlay>> = {}
) =>
  waitFor(() =>
    render(
      <GestureHandlerRootView>
        <PlayRangeOverlay
          range={{ fromMs: 2000, toMs: 5000 }}
          timeAxis={AXIS}
          height={100}
          shade='#111'
          fromColor='#0f0'
          toColor='#f0f'
          controlColor='#fff'
          onGrab={jest.fn()}
          onMoveEnd={jest.fn()}
          onPlay={jest.fn()}
          isPlaying={false}
          {...props}
        />
      </GestureHandlerRootView>
    )
  );

describe('a marked stretch on the axis', () => {
  it('shades from one end to the other', async () => {
    await draw();
    const shade = screen.getByTestId('play-range-shade');
    // Placed by a transform off a shared value rather than by `left`, so the
    // shading can follow the finger without a render (INV-NOTES-235). The
    // width is what says how far the stretch runs.
    expect(shade.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 3000,
          transform: [{ translateX: 2000 }]
        })
      ])
    );
  });

  it('draws nothing at all when nothing is marked', async () => {
    await draw({ range: null });
    expect(screen.queryByTestId('play-range-shade')).toBeNull();
    expect(screen.queryByTestId('play-range-play')).toBeNull();
  });

  it('draws both ends', async () => {
    await draw();
    expect(screen.getByTestId('play-range-from')).toBeTruthy();
    expect(screen.getByTestId('play-range-to')).toBeTruthy();
  });

  it('ACC-NOTES-250: a whole drag is written down once, on release', async () => {
    const onGrab = jest.fn();
    const onMoveEnd = jest.fn();
    await draw({ onGrab, onMoveEnd });

    // Touch, six frames of movement, release — the shape of a real drag.
    fireGestureHandler(getByGestureTestId('play-range-to-pan'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: 100 },
      { translationX: 200 },
      { translationX: 300 },
      { translationX: 400 },
      { translationX: 500 },
      { state: State.END, translationX: 600 }
    ]);

    // Once, when the finger lands. Not once per frame, which is what it used
    // to be — and what re-rendered the graph beside it sixty times a second.
    expect(onGrab).toHaveBeenCalledTimes(1);
    expect(onMoveEnd).toHaveBeenCalledTimes(1);
    // Where the last frame of the drag actually left it: 5000 + 500. The
    // release carries no movement of its own — what it carries is the fact
    // that the finger has gone.
    expect(onMoveEnd).toHaveBeenCalledWith('to', 5500);
  });

  it('plays when the control is pressed', async () => {
    const onPlay = jest.fn();
    await draw({ onPlay });
    await fireEvent.press(screen.getByTestId('play-range-play'));
    expect(onPlay).toHaveBeenCalled();
  });
});
