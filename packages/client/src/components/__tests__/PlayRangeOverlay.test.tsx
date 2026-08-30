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
    expect(shade.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ left: 2000, width: 3000 })
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

  it('plays when the control is pressed', async () => {
    const onPlay = jest.fn();
    await draw({ onPlay });
    await fireEvent.press(screen.getByTestId('play-range-play'));
    expect(onPlay).toHaveBeenCalled();
  });
});
