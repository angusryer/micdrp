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
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { PlaybackBar } from '../PlaybackBar';

/**
 * A track that reports a length, so the bar offers a toggle for it. A length
 * of 0 is a track the note does not have — a melody that implied no chords,
 * or a take nothing was read out of.
 */
export const backdrop = (durationMs = 4000) => ({
  start: jest.fn(),
  stop: jest.fn(),
  durationMs
});

/** The melody read from the take, which is the bar's third track. */
export const melodyVoice = backdrop;

/**
 * Renders the transport with its options sheet already open.
 *
 * The track toggles live in the sheet now (INT-NOTES-021), and every suite
 * using this fixture is about which tracks sound rather than about how the
 * sheet opens — so opening it here keeps those tests about their subject.
 */
export const renderPlaybackBar = async (
  resolveAudioUri: () => Promise<string | null>,
  accompaniment?: ReturnType<typeof backdrop>,
  voice?: ReturnType<typeof backdrop>
) => {
  const rendered = await waitFor(() =>
    render(
      <GestureHandlerRootView>
        <I18nProvider>
        <ThemeProvider>
          <PlaybackBar
            resolveAudioUri={resolveAudioUri}
            accompaniment={accompaniment}
            voice={voice}
          />
        </ThemeProvider>
        </I18nProvider>
      </GestureHandlerRootView>
    )
  );
  await fireEvent.press(screen.getByLabelText('Playback options'));
  return rendered;
};
