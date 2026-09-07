/**
 * ACC-NOTES-235 — INV-NOTES-221. Saying how long a bar is, having not tapped.
 *
 * The bar length reached the grid only through the tempo read from the taps,
 * and that reading needs at least two of them. So a take nobody tapped — or
 * one whose taps were lost on upload — could not be told it was in six-eight
 * by any route, and the control that would have said so was hidden, because
 * it was treated as a question about the taps.
 *
 * It is two facts wearing one control. How fast the pulse runs is a reading
 * of the taps and needs them. How long a bar is, is a fact about the music,
 * and the person who sang it knows it whether or not their hand was moving.
 */
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import { tempoFromPattern, type TapPattern } from 'logic';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { TapPatternRow } from '../TapPatternRow';

const show = async (tapCount: number, pattern?: TapPattern) => {
  const onSet = jest.fn();
  await waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <TapPatternRow
            pattern={pattern}
            tapCount={tapCount}
            bpm={null}
            onSet={onSet}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );
  return onSet;
};

describe('ACC-NOTES-235: a take nobody tapped', () => {
  it('is still asked how long its bar is', async () => {
    await show(0);
    expect(screen.queryByTestId('beats-per-bar')).not.toBeNull();
  });

  it('takes six beats to a bar', async () => {
    const onSet = await show(0, { beats: [1], beatsPerBar: 4 });
    await fireEvent.press(screen.getByTestId('beats-per-bar-up'));
    expect(onSet).toHaveBeenCalledWith({ beats: [1], beatsPerBar: 5 });
  });

  it('says plainly that no tempo can come from taps it does not have', async () => {
    // Rather than offering the control in silence, where a person would
    // reasonably expect the bpm to change and it would not.
    await show(0);
    expect(screen.queryByText(/Nothing was tapped/)).not.toBeNull();
    expect(screen.queryByText(/bar length still applies/)).not.toBeNull();
  });

  it('claims no tempo from taps that are not there', () => {
    expect(tempoFromPattern([], { beats: [1, 3, 5], beatsPerBar: 6 })).toBeNull();
  });
});

describe('a take with one tap', () => {
  it('can still be told its bar length', async () => {
    // One tap marks a moment and says nothing about a rate, but the bar is
    // not a claim about the tap.
    const onSet = await show(1, { beats: [1], beatsPerBar: 6 });
    await fireEvent.press(screen.getByTestId('tapped-beat-3'));
    expect(onSet).toHaveBeenCalledWith({ beats: [1, 3], beatsPerBar: 6 });
  });

  it('still says what one tap can and cannot do', async () => {
    await show(1);
    expect(screen.queryByText(/One tap marks a moment/)).not.toBeNull();
  });
});

describe('a take with taps', () => {
  it('reads as it did before', async () => {
    await show(8, { beats: [2, 4], beatsPerBar: 4 });
    expect(screen.queryByTestId('beats-per-bar')).not.toBeNull();
    expect(
      screen.queryByText(/do not sit on that pattern evenly enough/)
    ).not.toBeNull();
  });
});
