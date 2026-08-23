/**
 * The melody's own transport — INV-NOTES-067, INT-NOTES-019.
 *
 * Split out of HearItAs.test when the reading moved into the playback options
 * and this control stayed under the graph. The press that starts it is the
 * press that stops it, and — since the chosen reading is no longer written
 * beside it — it names that reading to whoever cannot see the list.
 *
 * `await waitFor(() => render(...))` before any query, matching HearItAs — a
 * bare render leaves the queries unbound in this setup.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { MelodyPlayToggle } from '../MelodyPlayToggle';

const setup = async (
  over: Partial<React.ComponentProps<typeof MelodyPlayToggle>> = {}
) => {
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const utils = await waitFor(() =>
    render(
      <ThemeProvider>
        <MelodyPlayToggle
          isPlaying={false}
          mode="as-sung"
          onPlay={onPlay}
          onStop={onStop}
          {...over}
        />
      </ThemeProvider>
    )
  );
  return { ...utils, onPlay, onStop };
};

describe('MelodyPlayToggle', () => {
  it('plays when asked', async () => {
    const { getByTestId, onPlay } = await setup();
    await fireEvent.press(getByTestId('hear-play'));
    expect(onPlay).toHaveBeenCalled();
  });

  it('stops what it started rather than starting it again', async () => {
    // A press that can only start leaves the singer with no way out of a
    // melody they are already hearing (INV-NOTES-067).
    const { getByTestId, onPlay, onStop } = await setup({ isPlaying: true });
    await fireEvent.press(getByTestId('hear-play'));
    expect(onStop).toHaveBeenCalled();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('says which of the two the next press would do', async () => {
    // Rendered fresh rather than rerendered: rerender is async in this setup.
    const idle = await setup({ isPlaying: false });
    expect(idle.getByText('Play melody')).toBeTruthy();

    const playing = await setup({ isPlaying: true });
    expect(playing.getByText('Stop melody')).toBeTruthy();
    // What a screen reader is told changes with it, not only the drawing.
    expect(playing.getByLabelText('Stop the melody')).toBeTruthy();
  });

  it('names the reading it would sound, now the choice is not beside it', async () => {
    const sung = await setup({ mode: 'as-sung' });
    expect(sung.getByLabelText('Play as sung')).toBeTruthy();

    const written = await setup({ mode: 'as-notated' });
    expect(written.getByLabelText('Play as written')).toBeTruthy();
  });
});
