/**
 * TransportBar — VIEW-NOTES-001's record control.
 *
 * The spec calls for a compact circle filled solid in the palette's red that
 * reads as a disc, not a ring. It used to be an 84pt primary-coloured circle
 * with a light dot inside; against the cream canvas that dot read as a hole,
 * so the control looked like a stroke. These tests pin the fill, the shape and
 * the absence of an idle cut-out.
 *
 * Render pattern: `await waitFor(() => render(...))` before touching `screen`,
 * matching PlaybackBar.test.tsx — a bare render leaves `screen` unbound here.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { ETheme, palettes } from '../../../configs/theme';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import type { RecordingStateValue } from '../../../state/recordingMachine';
import { TransportBar } from '../TransportBar';

const RED = palettes.light[ETheme.Blue].colors.error;

const renderBar = (state: RecordingStateValue) =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider initialPalette={ETheme.Blue}>
          <TransportBar state={state} onStart={jest.fn()} onStop={jest.fn()} />
        </ThemeProvider>
      </I18nProvider>
    )
  );

const buttonStyle = () =>
  StyleSheet.flatten(screen.getByTestId('transport-button').props.style) as {
    backgroundColor: string;
    width: number;
    height: number;
    borderRadius: number;
  };

describe('TransportBar', () => {
  it('is a solid red disc with no cut-out when idle', async () => {
    await renderBar('idle');

    const style = buttonStyle();
    expect(style.backgroundColor).toBe(RED);
    expect(style.width).toBeLessThanOrEqual(64);
    expect(style.height).toBe(style.width);
    expect(style.borderRadius).toBe(style.width / 2);
    expect(screen.queryByTestId('transport-stop-glyph')).toBeNull();
  });

  it('stays red and shows a stop glyph while recording', async () => {
    await renderBar('recording');

    expect(buttonStyle().backgroundColor).toBe(RED);
    expect(screen.getByTestId('transport-stop-glyph')).toBeTruthy();
  });
});
