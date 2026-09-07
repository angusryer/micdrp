/**
 * ACC-NOTES-232 — the six-eight case, through the control a thumb uses.
 *
 * "I just sang a phrase and it was in 6/8 and I tapped 1, 3, and 5. But I
 * have no way to input that." The presets are four-four and three-four; the
 * pattern he sang is neither, and the offered list was the whole vocabulary.
 */
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import type { TapPattern } from 'logic';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { TapPatternEditor } from '../TapPatternEditor';
import { TapPatternRow } from '../TapPatternRow';

const editor = async (pattern: TapPattern, onSet = jest.fn()) => {
  await waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <TapPatternEditor pattern={pattern} onSet={onSet} />
        </ThemeProvider>
      </I18nProvider>
    )
  );
  return onSet;
};

describe('saying how long the bar is', () => {
  it('shows the count, so the number is readable and not only nudged', async () => {
    await editor({ beats: [1], beatsPerBar: 6 });
    expect(screen.getByTestId('beats-per-bar')).toHaveTextContent('6');
  });

  it('steps up one at a time', async () => {
    const onSet = await editor({ beats: [1], beatsPerBar: 4 });
    await fireEvent.press(screen.getByTestId('beats-per-bar-up'));
    expect(onSet).toHaveBeenCalledWith({ beats: [1], beatsPerBar: 5 });
  });

  it('steps down, dropping a beat the shorter bar cannot hold', async () => {
    const onSet = await editor({ beats: [1, 5], beatsPerBar: 5 });
    await fireEvent.press(screen.getByTestId('beats-per-bar-down'));
    expect(onSet).toHaveBeenCalledWith({ beats: [1], beatsPerBar: 4 });
  });

  it('will not go below one beat', async () => {
    const onSet = await editor({ beats: [1], beatsPerBar: 1 });
    await fireEvent.press(screen.getByTestId('beats-per-bar-down'));
    expect(onSet).not.toHaveBeenCalled();
  });
});

describe('ACC-NOTES-232: saying which beats were tapped', () => {
  it('offers one for each beat the bar holds, and no more', async () => {
    await editor({ beats: [1], beatsPerBar: 6 });
    expect(screen.queryByTestId('tapped-beat-6')).not.toBeNull();
    expect(screen.queryByTestId('tapped-beat-7')).toBeNull();
  });

  it('chooses one that was not chosen', async () => {
    const onSet = await editor({ beats: [1, 3], beatsPerBar: 6 });
    await fireEvent.press(screen.getByTestId('tapped-beat-5'));
    expect(onSet).toHaveBeenCalledWith({ beats: [1, 3, 5], beatsPerBar: 6 });
  });

  it('unchooses one that was', async () => {
    const onSet = await editor({ beats: [1, 3, 5], beatsPerBar: 6 });
    await fireEvent.press(screen.getByTestId('tapped-beat-3'));
    expect(onSet).toHaveBeenCalledWith({ beats: [1, 5], beatsPerBar: 6 });
  });

  it('says which beat it is to a screen reader, not just a bare number', async () => {
    await editor({ beats: [1], beatsPerBar: 6 });
    expect(
      screen.queryByLabelText('Beat 5 of 6 was tapped')
    ).not.toBeNull();
  });
});

const row = async (pattern: TapPattern | undefined, tapCount: number) => {
  const onSet = jest.fn();
  await waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <TapPatternRow
            pattern={pattern}
            tapCount={tapCount}
            bpm={120}
            onSet={onSet}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );
  return onSet;
};

describe('the editor beside the presets', () => {
  it('opens with no beat chosen where nobody has said anything', async () => {
    // Showing the suggestion highlighted would say a pattern was set while
    // the pill above said none was (INV-NOTES-161).
    await row(undefined, 4);
    expect(
      screen.getByTestId('tapped-beat-1').props.accessibilityState
    ).toMatchObject({ checked: false });
  });

  it('shows what is set, where something is', async () => {
    await row({ beats: [1, 3, 5], beatsPerBar: 6 }, 4);
    expect(
      screen.getByTestId('tapped-beat-3').props.accessibilityState
    ).toMatchObject({ checked: true });
    expect(
      screen.getByTestId('tapped-beat-2').props.accessibilityState
    ).toMatchObject({ checked: false });
  });

  it('is offered on a take with nothing tapped, for the bar length', async () => {
    // Hidden there until INV-NOTES-221: how long a bar is, is a fact about
    // the music, and a take whose taps were lost had no route to it.
    await row(undefined, 0);
    expect(screen.queryByTestId('beats-per-bar')).not.toBeNull();
  });
});
