/**
 * Pausing a take — INV-NOTES-152 / INT-NOTES-028.
 *
 * The maintainer asked to be able to pause a take mid-play so the moment
 * reached stays on the screen to be read. The control already drew a pause and
 * called itself Pause; what it did was stop, so the playhead jumped back to
 * where the last press began and took the answer with it.
 *
 * What these pin is the moment surviving the press: the position after a pause
 * is where the take had run to, everything else falls silent, and the next
 * press schedules the take from that same offset rather than from the top.
 *
 * The engine's clock is the double's `nowMs`, so "twelve seconds in" is a
 * return value rather than a wait.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

jest.mock('../../../specs/NativeSynth', () => ({
  __esModule: true,
  // Required in the factory, not closed over: a factory runs before this
  // module's own bindings exist.
  default: (require('../__fixtures__/synthDouble') as typeof import('../__fixtures__/synthDouble'))
    .synthDouble
}));

import { resetSynthDouble, synthDouble as synth } from '../__fixtures__/synthDouble';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { PlaybackBar } from '../PlaybackBar';
import { backdrop, renderPlaybackBar } from '../__fixtures__/renderPlaybackBar';
import { SCHEDULE_LEAD_MS } from '../../../audio/audioClock';

const REMOTE = 'https://micdrp-backend.fly.dev/api/files/notes/abc/a.wav?token=t';

/** Where the take had got to when the press landed, on the engine's clock. */
const PAUSED_AT_MS = 12_000;
const REACHED_MS = PAUSED_AT_MS - SCHEDULE_LEAD_MS;

/** The offset every sample scheduled in this run was asked to start from. */
const scheduledFrom = (): number[] =>
  (synth.scheduleSamples.mock.calls as [{ fromMs: number }[]][]).map(
    ([samples]) => samples[0].fromMs
  );

interface Transport {
  positionMs: number;
  drawnPositionMs: SharedValue<number>;
}

/** The bar, with the transport it reports kept for reading afterwards. */
const renderWithTransport = async () => {
  const seen: { current: Transport | null } = { current: null };
  await waitFor(() =>
    render(
      <GestureHandlerRootView>
        <I18nProvider>
          <ThemeProvider>
            <PlaybackBar
              resolveAudioUri={() => Promise.resolve(REMOTE)}
              onTransport={(transport) => {
                seen.current = transport;
              }}
            />
          </ThemeProvider>
        </I18nProvider>
      </GestureHandlerRootView>
    )
  );
  return seen;
};

const playThenPause = async () => {
  await fireEvent.press(screen.getByLabelText('Play'));
  await waitFor(() => expect(synth.scheduleSamples).toHaveBeenCalled());
  // Twelve seconds of take go by on the engine's clock.
  synth.nowMs.mockReturnValue(PAUSED_AT_MS);
  await fireEvent.press(screen.getByLabelText('Pause'));
  await waitFor(() => expect(screen.getByLabelText('Play')).toBeTruthy());
};

describe('pausing a take', () => {
  beforeEach(resetSynthDouble);

  it('leaves the playhead on the moment it was pressed at', async () => {
    const transport = await renderWithTransport();

    await playThenPause();

    // The moment the ear was at, not the top of the take: this is the whole
    // point of stopping mid-take — to look at what is under the head.
    // On the shared value alone. A ticking number was published here too,
    // and re-rendering the screen twice a second to carry it is what left a
    // press of pause with nowhere to be handled (INV-NOTES-206).
    await waitFor(() =>
      expect(transport.current?.drawnPositionMs.value).toBe(REACHED_MS)
    );
  });

  it('picks the take up from there on the next press', async () => {
    await renderWithTransport();

    await playThenPause();
    await fireEvent.press(screen.getByLabelText('Play'));

    await waitFor(() => expect(scheduledFrom()).toHaveLength(2));
    // The first press started at the top; the second carries on.
    expect(scheduledFrom()).toEqual([0, REACHED_MS]);
    // Decoded once. A resumed take is a schedule and nothing else, which is
    // what makes picking it up immediate (INV-NOTES-133).
    expect(synth.loadSample).toHaveBeenCalledTimes(1);
  });

  it('silences the tracks playing over the take', async () => {
    // Silence is still silence — a pause holds the moment, not the sound
    // (INV-NOTES-018).
    const chords = backdrop();
    await renderPlaybackBar(() => Promise.resolve(REMOTE), chords);

    await fireEvent.press(screen.getByLabelText('Play'));
    await waitFor(() => expect(chords.start).toHaveBeenCalled());
    chords.stop.mockClear();
    synth.nowMs.mockReturnValue(PAUSED_AT_MS);
    await fireEvent.press(screen.getByLabelText('Pause'));

    await waitFor(() => expect(chords.stop).toHaveBeenCalled());
    // The whole engine, so a pause cannot miss a voice (INV-NOTES-205).
    expect(synth.clearAll).toHaveBeenCalled();
  });

  it('starts every track together again from the moment it held', async () => {
    // One performance heard several ways: a backdrop that resumed from the
    // top would put a different chord under every note (INV-NOTES-069).
    const chords = backdrop(60_000);
    await renderPlaybackBar(() => Promise.resolve(REMOTE), chords);

    await fireEvent.press(screen.getByLabelText('Play'));
    await waitFor(() => expect(chords.start).toHaveBeenCalled());
    synth.nowMs.mockReturnValue(PAUSED_AT_MS);
    await fireEvent.press(screen.getByLabelText('Pause'));
    await waitFor(() => expect(screen.getByLabelText('Play')).toBeTruthy());
    chords.start.mockClear();

    await fireEvent.press(screen.getByLabelText('Play'));

    // Where the take is by the time the backdrop sounds, which is the moment
    // held plus the lead the take was scheduled with (INV-NOTES-020).
    await waitFor(() => expect(chords.start).toHaveBeenCalledTimes(1));
    const [startedAt] = chords.start.mock.calls[0] as [number];
    expect(startedAt).toBeGreaterThanOrEqual(REACHED_MS);
  });
});
