/**
 * The control that opens the playback options — INV-NOTES-075.
 *
 * It draws a sliders glyph and carries no word. The Skia mock draws nothing,
 * so the glyph is asserted through the testID the button puts around it rather
 * than the path itself, as PlaybackButton.test.tsx does.
 *
 * That a press actually raises the sheet is covered where the sheet's contents
 * are: __fixtures__/renderPlaybackBar opens it by this control's label before
 * every mix test.
 *
 * `await waitFor(() => render(...))` before any query — a bare render leaves
 * the queries unbound in this setup.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { PlaybackOptionsButton } from '../PlaybackOptionsButton';

const setup = async (onPress = jest.fn()) => {
  const rendered = await waitFor(() =>
    render(
      <ThemeProvider>
        <PlaybackOptionsButton onPress={onPress} />
      </ThemeProvider>
    )
  );
  return { ...rendered, onPress };
};

describe('PlaybackOptionsButton', () => {
  it('draws a glyph', async () => {
    const { getByTestId } = await setup();

    expect(getByTestId('playback-options-glyph')).toBeTruthy();
  });

  it('carries no word', async () => {
    const { queryByText } = await setup();

    expect(queryByText(/options/i)).toBeNull();
  });

  it('still says what it opens, for a screen reader', async () => {
    const { getByLabelText } = await setup();

    expect(getByLabelText('Playback options')).toBeTruthy();
  });

  it('asks for the sheet when pressed', async () => {
    const { getByTestId, onPress } = await setup();

    await fireEvent.press(getByTestId('playback-options'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
