/**
 * The control — ACC-DOG-005 / ACC-DOG-008 / VIEW-DOG-001.
 *
 * One control with two shapes. The round mark starts a clip; the square it
 * becomes ends it and sends it. What is pinned here is that there is no third
 * state and no second control: a pause used to sit under the first tap and a
 * separate stop beside it, so the tap that looked like "done" only held the
 * recording, and the thing that actually sent it was somewhere else.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';

jest.mock('../../audio/AudioEngine', () => ({
  __esModule: true,
  audioEngine: { requestPermission: jest.fn(() => Promise.resolve(true)) }
}));

// The queue is a network and a filesystem away; what it receives is upload.ts's
// business, not the control's.
jest.mock('../upload', () => ({
  enqueue: jest.fn(),
  flushPending: jest.fn(() => Promise.resolve())
}));

import { markBusy, resetBusyForTests } from '../../app/activity';
import { ETheme, palettes } from '../../configs/theme';
import { I18nProvider } from '../../i18n';
import { ThemeProvider } from '../../theme';
import { activeSession, resetActiveSessionForTests } from '../activeSession';
import { CLIP_CAP_MS } from '../config';
import DogfoodControl from '../DogfoodControl';
import { publishRoute, resetRouteForTests } from '../route';

const RECORD = 'Record feedback';
const STOP = 'Stop and send feedback';
const { caution, error, gray300 } = palettes.light[ETheme.Blue].colors;

const renderControl = () =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider initialPalette={ETheme.Blue}>
          <DogfoodControl />
        </ThemeProvider>
      </I18nProvider>
    )
  );

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  resetBusyForTests();
  resetActiveSessionForTests();
  resetRouteForTests();
  publishRoute('Notes');
});

describe('DogfoodControl', () => {
  it('starts recording when the round control is tapped', async () => {
    const view = await renderControl();

    await fireEvent.press(view.getByLabelText(RECORD));

    expect(activeSession().snapshot().state).toBe('recording');
    await waitFor(() => expect(view.getByLabelText(STOP)).toBeTruthy());
  });

  it('ACC-DOG-005: the same control stops, and nothing pauses', async () => {
    const view = await renderControl();
    await fireEvent.press(view.getByLabelText(RECORD));
    await waitFor(() => expect(view.getByLabelText(STOP)).toBeTruthy());

    await fireEvent.press(view.getByLabelText(STOP));

    // Stopped, not held: a second tap on the one control ends the clip.
    await waitFor(() => expect(activeSession().snapshot().state).toBe('idle'));
    await waitFor(() => expect(view.getByLabelText(RECORD)).toBeTruthy());
  });

  it('offers exactly one control while recording', async () => {
    const view = await renderControl();
    await fireEvent.press(view.getByLabelText(RECORD));
    await waitFor(() => expect(view.getByLabelText(STOP)).toBeTruthy());

    // The separate stop button is gone; aiming at the header is hard enough
    // with one target in it.
    expect(view.queryAllByRole('button')).toHaveLength(1);
    expect(view.queryByLabelText('Pause feedback recording')).toBeNull();
  });

  it('stays stoppable if a take claims the microphone mid-clip', async () => {
    // The separate stop control used to be the way out of this. Disabling the
    // one control that is left would strand whatever had been said.
    const view = await renderControl();
    await fireEvent.press(view.getByLabelText(RECORD));
    await waitFor(() => expect(view.getByLabelText(STOP)).toBeTruthy());

    await act(async () => {
      markBusy('capture');
    });
    await fireEvent.press(view.getByLabelText(STOP));

    await waitFor(() => expect(activeSession().snapshot().state).toBe('idle'));
  });

  it('VIEW-DOG-001: the time counts down from the cap, never up from zero', async () => {
    // Spied before the first render, because the session captures Date.now
    // when it is constructed and the control constructs it.
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const view = await renderControl();

    await fireEvent.press(view.getByLabelText(RECORD));

    await waitFor(() => expect(view.getByText('2:00')).toBeTruthy());
    now += 30_000;
    await waitFor(() => expect(view.getByText('1:30')).toBeTruthy());
  });

  it('ACC-DOG-032/033: the countdown warms as the end approaches', async () => {
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const view = await renderControl();
    await fireEvent.press(view.getByLabelText(RECORD));

    const colourOf = (time: string) =>
      (
        StyleSheet.flatten(view.getByText(time).props.style) as {
          color?: string;
        }
      ).color;

    await waitFor(() => expect(colourOf('2:00')).toBe(gray300));
    now += CLIP_CAP_MS - 15_000;
    await waitFor(() => expect(colourOf('0:15')).toBe(caution));
    now += 10_000;
    await waitFor(() => expect(colourOf('0:05')).toBe(error));
  });

  it('ACC-DOG-034: running out of time says another remark can be recorded', async () => {
    let now = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderControl();
    await fireEvent.press(view.getByLabelText(RECORD));

    now += CLIP_CAP_MS;

    // The cap sends the clip on its own, so the alert is the only thing that
    // tells a speaker looking at the screen rather than the header.
    await waitFor(() => expect(activeSession().snapshot().state).toBe('idle'));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    expect(alert.mock.calls[0][1]).toBe(
      "If you didn't describe your feature, and you've run out of time, you can submit another feature request."
    );
  });

  it('ACC-DOG-035: tapping stop raises no alert', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderControl();
    await fireEvent.press(view.getByLabelText(RECORD));
    await waitFor(() => expect(view.getByLabelText(STOP)).toBeTruthy());

    await fireEvent.press(view.getByLabelText(STOP));

    // Ending it then was the instruction; confirming an instruction is noise.
    await waitFor(() => expect(activeSession().snapshot().state).toBe('idle'));
    expect(alert).not.toHaveBeenCalled();
  });

  it('ACC-DOG-002: is unavailable while a take holds the microphone', async () => {
    markBusy('capture');
    const view = await renderControl();

    await fireEvent.press(view.getByLabelText(RECORD));

    expect(activeSession().snapshot().state).toBe('idle');
  });
});
