/**
 * The note detail's transport — INV-NOTES-030.
 *
 * The shape is the message: one circle of one size in every state, a triangle
 * when a press would start the take and a pair of bars when it would pause,
 * and no word to read. The Skia mock draws nothing, so the glyph is asserted
 * through the testID the button puts on it rather than the path itself.
 *
 * `await waitFor(() => render(...))` before any query — a bare render leaves
 * the queries unbound in this setup.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { PlaybackButton } from '../PlaybackButton';
import type { PlaybackState } from '../usePlayback';

const setup = async (state: PlaybackState) =>
  waitFor(() =>
    render(
      <ThemeProvider>
        <PlaybackButton state={state} onPlay={jest.fn()} onPause={jest.fn()} />
      </ThemeProvider>
    )
  );

/** The button's flattened style, whichever state produced it. */
const shapeOf = (style: unknown) =>
  (Array.isArray(style) ? Object.assign({}, ...style.flat()) : style) as {
    width: number;
    height: number;
    borderRadius: number;
  };

describe('PlaybackButton', () => {
  it('is a circle: as tall as it is wide, rounded to its own radius', async () => {
    const { getByTestId } = await setup('stopped');
    const shape = shapeOf(getByTestId('playback-button').props.style);

    expect(shape.height).toBe(shape.width);
    expect(shape.borderRadius).toBe(shape.width / 2);
  });

  it('keeps that one size while the take is being fetched', async () => {
    const stopped = shapeOf((await setup('stopped')).getByTestId('playback-button').props.style);
    const loading = shapeOf((await setup('loading')).getByTestId('playback-button').props.style);

    expect(loading.width).toBe(stopped.width);
    expect(loading.height).toBe(stopped.height);
  });

  it('draws a triangle when a press would start the take', async () => {
    const { getByTestId, queryByTestId } = await setup('stopped');

    expect(getByTestId('playback-glyph-play')).toBeTruthy();
    expect(queryByTestId('playback-glyph-pause')).toBeNull();
  });

  it('draws the pause bars once the take is playing', async () => {
    const { getByTestId, queryByTestId } = await setup('playing');

    expect(getByTestId('playback-glyph-pause')).toBeTruthy();
    expect(queryByTestId('playback-glyph-play')).toBeNull();
  });

  it('offers the triangle again once the take is stopped', async () => {
    const { getByTestId } = await setup('stopped');

    expect(getByTestId('playback-glyph-play')).toBeTruthy();
  });

  it('carries no word, in any state', async () => {
    for (const state of ['stopped', 'loading', 'playing', 'error'] as const) {
      const { queryByText } = await setup(state);
      expect(queryByText(/play|pause|stop/i)).toBeNull();
    }
  });

  it('still says which press it offers, for a screen reader', async () => {
    expect((await setup('stopped')).getByLabelText('Play')).toBeTruthy();
    expect((await setup('playing')).getByLabelText('Pause')).toBeTruthy();
  });
});
