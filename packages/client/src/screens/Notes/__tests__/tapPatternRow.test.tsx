/**
 * ACC-NOTES-222 / ACC-NOTES-223 / ACC-NOTES-224 / INV-NOTES-209 — saying what
 * the taps were for, and taking it back.
 *
 * Tapping every beat to establish a tempo is most of a performance spent on
 * bookkeeping, and mid-song you do not yet know whether you will tap every
 * beat or only the backbeat. So the tap means nothing and the meaning is
 * supplied here.
 *
 * The thing these guard is that nothing is asserted on the singer's behalf: a
 * take opens on "not set", the marks stay marks, and the grid is the one it
 * had (INV-NOTES-161). The picker opening on the backbeat is an offer, not a
 * claim, and the difference between those two is the whole invariant.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { TapPatternRow, patternLabel } from '../TapPatternRow';
import { SUGGESTED_TAP_PATTERN, type TapPattern } from 'logic';

const show = async (
  props: Partial<React.ComponentProps<typeof TapPatternRow>> = {}
) => {
  const onSet = jest.fn();
  await waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <TapPatternRow
            pattern={undefined}
            tapCount={8}
            bpm={null}
            onSet={onSet}
            {...props}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );
  return onSet;
};

describe('a take that was tapped', () => {
  it('ACC-NOTES-223: opens on nothing said, holding the taps as marks', async () => {
    await show();
    // "Not set" is chosen, so the grid is whatever it was.
    expect(screen.getByTestId('tap-pattern-none').props.accessibilityState)
      .toMatchObject({ selected: true });
    expect(screen.getByText(/held as marks/)).toBeTruthy();
  });

  it('offers the backbeat without asserting it', async () => {
    await show();
    const backbeat = screen.getByLabelText(
      `The taps were ${patternLabel(SUGGESTED_TAP_PATTERN)}`
    );
    // Present to be chosen, and not chosen.
    expect(backbeat.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('ACC-NOTES-222: says what the taps were when one is chosen', async () => {
    const onSet = await show();
    void fireEvent.press(
      screen.getByLabelText(`The taps were ${patternLabel(SUGGESTED_TAP_PATTERN)}`)
    );
    expect(onSet).toHaveBeenCalledWith(
      expect.objectContaining({ beats: [2, 4], beatsPerBar: 4 })
    );
  });

  it('ACC-NOTES-224: takes it back, which restores the grid', async () => {
    const chosen: TapPattern = { beats: [1, 3], beatsPerBar: 4 };
    const onSet = await show({ pattern: chosen, bpm: 96 });
    void fireEvent.press(screen.getByTestId('tap-pattern-none'));
    // Undefined is a real answer: the marks go back to being marks and
    // nothing had to be overwritten to get there.
    expect(onSet).toHaveBeenCalledWith(undefined);
  });

  it('says what the taps come to once they have been read', async () => {
    await show({ pattern: SUGGESTED_TAP_PATTERN, bpm: 96.4 });
    expect(screen.getByText(/96 bpm, from 8 taps/)).toBeTruthy();
  });

  it('says so when the taps do not agree with what was claimed', async () => {
    await show({ pattern: SUGGESTED_TAP_PATTERN, bpm: null });
    expect(screen.getByText(/do not sit on that pattern/)).toBeTruthy();
  });
});

describe('a take with too little to go on', () => {
  it('asks nothing of a take nobody tapped', async () => {
    await show({ tapCount: 0 });
    // A control for a take with no taps is a question with no answer.
    expect(screen.queryByTestId('tap-pattern-none')).toBeNull();
  });

  it('greys the patterns for a single tap rather than hiding them', async () => {
    await show({ tapCount: 1 });
    const backbeat = screen.getByLabelText(
      `The taps were ${patternLabel(SUGGESTED_TAP_PATTERN)}`
    );
    // Greyed reads as a limit; vanished reads as a bug.
    expect(backbeat.props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('how a pattern is written down', () => {
  it('says it the way a person would', () => {
    expect(patternLabel({ beats: [2, 4], beatsPerBar: 4 })).toBe('2 and 4 of 4');
    expect(patternLabel({ beats: [1], beatsPerBar: 4 })).toBe('beat 1 of 4');
    expect(patternLabel({ beats: [1, 2, 3, 4], beatsPerBar: 4 })).toBe(
      'every beat of 4'
    );
    expect(patternLabel({ beats: [1, 2, 3], beatsPerBar: 3 })).toBe(
      'every beat of 3'
    );
  });
});
