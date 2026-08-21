/**
 * PlaybackBar — INV-NOTES-012 / ACC-NOTES-024.
 *
 * A note served from the backend carries an https URL with a session token;
 * only a capture that has not synced carries file://. The component used to
 * strip a file:// prefix and read the result with RNFS as a local path, so
 * every backend-served note — which is every note after a sync — failed to
 * play. These tests pin the URL reaching the decoder untouched.
 *
 * INV-NOTES-014 sits on top of that: the URL is now produced by a resolver
 * called when Play is pressed, because a PocketBase file token lives about two
 * minutes. Signing at sync time and caching the result — what the code did
 * before — meant every note played more than two minutes later fetched with a
 * dead token, which is why playback still failed after the first fix.
 *
 * Note the render pattern: `await waitFor(() => render(...))` before touching
 * `screen`, matching ErrorBoundary.test.tsx. A bare render() leaves `screen`
 * unbound in this setup and every query throws notImplemented.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockDecode = jest.fn();
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockStart = jest.fn();

jest.mock('react-native-audio-api', () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    destination: {},
    decodeAudioData: mockDecode,
    createBufferSource: () => ({
      buffer: null,
      connect: jest.fn(),
      start: mockStart,
      stop: jest.fn(),
      onended: null
    }),
    close: mockClose
  }))
}));

import { ThemeProvider } from '../../../theme';
import { PlaybackBar } from '../PlaybackBar';

const REMOTE =
  'https://micdrp-backend.fly.dev/api/files/notes/abc123/audio.wav?token=t0ken';
const LOCAL = 'file:///var/mobile/tmp/micdrp-abc.wav';

const renderBar = (audioUri: string | null) =>
  waitFor(() =>
    render(
      <ThemeProvider>
        <PlaybackBar resolveAudioUri={() => Promise.resolve(audioUri)} />
      </ThemeProvider>
    )
  );

describe('PlaybackBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecode.mockResolvedValue({ duration: 3 });
  });

  it('passes a backend https URL to the decoder unchanged', async () => {
    await renderBar(REMOTE);
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(mockDecode).toHaveBeenCalled());
    expect(mockDecode).toHaveBeenCalledWith(REMOTE);
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
  });

  it('passes a local file:// URI to the decoder unchanged', async () => {
    await renderBar(LOCAL);
    await fireEvent.press(screen.getByLabelText('Play'));

    // Still prefixed: stripping file:// is what broke the remote case, and the
    // decoder wants the scheme for the local case too.
    await waitFor(() => expect(mockDecode).toHaveBeenCalledWith(LOCAL));
  });

  it('surfaces an error state and logs the cause when decoding fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockDecode.mockRejectedValue(new Error('unsupported format'));

    await renderBar(REMOTE);
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(screen.getByText('Playback failed')).toBeTruthy());
    // The cause must reach the log; swallowing it is why this was opaque.
    expect(warn).toHaveBeenCalledWith(
      '[PlaybackBar] playback failed for',
      REMOTE,
      expect.any(Error)
    );
    warn.mockRestore();
  });
});
