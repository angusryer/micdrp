/**
 * Choosing how to hear a take — INV-NOTES-026.
 *
 * The reason both exist is that a complaint about playback should stop being
 * ambiguous between the detector and the notation.
 *
 * `await waitFor(() => render(...))` before any query, matching ChordCard —
 * a bare render leaves the queries unbound in this setup.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { HearItAs } from '../HearItAs';

const setup = async (over: Partial<React.ComponentProps<typeof HearItAs>> = {}) => {
  const onChange = jest.fn();
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const utils = await waitFor(() =>
    render(
      <ThemeProvider>
        <HearItAs
          mode="as-sung"
          onChange={onChange}
          onPlay={onPlay}
          onStop={onStop}
          isPlaying={false}
          canNotate
          {...over}
        />
      </ThemeProvider>
    )
  );
  return { ...utils, onChange, onPlay, onStop };
};

describe('HearItAs', () => {
  it('offers both readings', async () => {
    const { getByTestId } = await setup();
    expect(getByTestId('hear-as-sung')).toBeTruthy();
    expect(getByTestId('hear-as-notated')).toBeTruthy();
  });

  it('switches to the other reading when asked', async () => {
    const { getByTestId, onChange } = await setup();
    await fireEvent.press(getByTestId('hear-as-notated'));
    expect(onChange).toHaveBeenCalledWith('as-notated');
  });

  it('plays when asked', async () => {
    const { getByTestId, onPlay } = await setup();
    await fireEvent.press(getByTestId('hear-play'));
    expect(onPlay).toHaveBeenCalled();
  });

  it('stops what it started rather than starting it again', async () => {
    // A press that can only start leaves the singer with no way out of a
    // melody they are already hearing (INV-NOTES-031).
    const { getByTestId, onPlay, onStop } = await setup({ isPlaying: true });
    await fireEvent.press(getByTestId('hear-play'));
    expect(onStop).toHaveBeenCalled();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('says which of the two the next press would do', async () => {
    // Rendered fresh rather than rerendered, as below.
    const idle = await setup({ isPlaying: false });
    expect(idle.getByText('Play melody')).toBeTruthy();

    const playing = await setup({ isPlaying: true });
    expect(playing.getByText('Stop melody')).toBeTruthy();
    // What a screen reader is told changes with it, not only the drawing.
    expect(playing.getByLabelText('Stop the melody')).toBeTruthy();
  });

  it('will not offer notation for a take that has no grid', async () => {
    // Offering it would promise something the take cannot answer.
    const { getByTestId, onChange } = await setup({ canNotate: false });
    await fireEvent.press(getByTestId('hear-as-notated'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says which reading is playing, so the difference is attributable', async () => {
    // Rendered fresh rather than rerendered: rerender is async in this setup
    // too, and a stale query reads as a missing element.
    const sung = await setup({ mode: 'as-sung' });
    expect(sung.getByText('exact pitch and timing detected')).toBeTruthy();

    const notated = await setup({ mode: 'as-notated' });
    expect(notated.getByText('snapped to notes and beats')).toBeTruthy();
  });
});
