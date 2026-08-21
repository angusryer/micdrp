/**
 * Rendering a PlaybackBar under the providers it expects, plus a stand-in for
 * the note's chord backdrop.
 *
 * `await waitFor(() => render(...))` before touching any query, matching
 * renderNoteCard.tsx — a bare render leaves `screen` unbound here.
 *
 * Shared by the suites either side of the bar: PlaybackBar.test.tsx (the
 * transport, INV-NOTES-018) and playbackMix.test.tsx (what a press sounds,
 * INV-NOTES-019).
 */
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { PlaybackBar } from '../PlaybackBar';

/**
 * A chord backdrop that reports a length, so the bar offers the choice of
 * what to sound. A length of 0 is a melody that implied no chords.
 */
export const backdrop = (durationMs = 4000) => ({
  start: jest.fn(),
  stop: jest.fn(),
  durationMs
});

export const renderPlaybackBar = (
  resolveAudioUri: () => Promise<string | null>,
  accompaniment?: ReturnType<typeof backdrop>
) =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <PlaybackBar
            resolveAudioUri={resolveAudioUri}
            accompaniment={accompaniment}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );
