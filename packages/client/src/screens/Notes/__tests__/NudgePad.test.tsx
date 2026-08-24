/**
 * INV-NOTES-111 — moving a note without covering it.
 *
 * Dragging on the graph stays the fast way, and the loupe fixes what it can
 * (INV-NOTES-110) — but the note being aimed at is still under the hand aiming
 * at it, and a semitone lane is a few points tall. This control puts the hand
 * somewhere else entirely: the note stays in full view while it moves, one
 * notch is exactly one step, and a set moves as readily as a single note.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { NudgePad } from '../NudgePad';

const show = (
  onPitch: (n: number) => void,
  onTime: (n: number) => void,
  canMoveInTime = true
) =>
  render(
    <GestureHandlerRootView>
      <I18nProvider>
        <ThemeProvider>
          <NudgePad
            onPitch={onPitch}
            onTime={onTime}
            canMoveInTime={canMoveInTime}
          />
        </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );

describe('the nudge pad', () => {
  it('offers pitch always, and time only where there is a beat', async () => {
    await show(jest.fn(), jest.fn(), true);
    expect(
      screen.queryByLabelText(/move the notes by a semitone/)
    ).not.toBeNull();
    expect(screen.queryByLabelText(/move the notes in time/)).not.toBeNull();
  });

  it('withholds the time bar when the take has no tempo', async () => {
    // A sixteenth of nothing is not a distance, so the control that would
    // move by one is not offered rather than offered and inert.
    await show(jest.fn(), jest.fn(), false);
    expect(
      screen.queryByLabelText(/move the notes by a semitone/)
    ).not.toBeNull();
    expect(screen.queryByLabelText(/move the notes in time/)).toBeNull();
  });

  it('says which way it moved things, once it has', async () => {
    await show(jest.fn(), jest.fn());
    expect(screen.queryByText(/Drag up for pitch/)).not.toBeNull();
  });
});
