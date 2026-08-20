/**
 * CaptureSection — VIEW-NOTES-001's live preview.
 *
 * The spec calls the pitch trace a slim band, kept short enough that the note
 * list below stays the larger half of the screen. It used to be 132pt tall,
 * which ate the top third of a phone before a single note card appeared. These
 * tests pin the band's height and that the frame and the canvas inside it
 * agree about it — the two used to be separate literals.
 *
 * Render pattern: `await waitFor(() => render(...))` before touching `screen`,
 * matching TransportBar.test.tsx — a bare render leaves `screen` unbound here.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import { ETheme } from '../../../configs/theme';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { CaptureSection } from '../CaptureSection';
import { PITCH_LINE_HEIGHT, pitchLineWidth } from '../captureLayout';

const shared = <T,>(value: T) => ({ value }) as never;

const renderSection = () =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider initialPalette={ETheme.Blue}>
          <CaptureSection
            sharedMidi={shared(60)}
            sharedCents={shared(0)}
            sharedFrame={shared(0)}
            state="idle"
            isRecording={false}
            saveStatus="idle"
            onStart={jest.fn()}
            onStop={jest.fn()}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );

const previewStyle = () =>
  StyleSheet.flatten(screen.getByTestId('pitch-preview').props.style) as {
    height: number;
    marginHorizontal: number;
  };

describe('CaptureSection', () => {
  it('draws the live preview as a slim band, not a third of the screen', async () => {
    await renderSection();

    const { height } = previewStyle();
    expect(height).toBe(PITCH_LINE_HEIGHT);
    // Comfortably under the old 132pt, and a minority of a short phone's
    // height so the list below it keeps the bulk of the screen.
    expect(height).toBeLessThanOrEqual(80);
    expect(height).toBeLessThan(Dimensions.get('window').height / 4);
  });

  it('insets the canvas by the same margin the frame uses', async () => {
    await renderSection();

    const { marginHorizontal } = previewStyle();
    const screenWidth = Dimensions.get('window').width;
    expect(pitchLineWidth(screenWidth)).toBe(
      screenWidth - 2 * marginHorizontal
    );
  });
});
