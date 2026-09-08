/**
 * ACC-NOTES-241 / INV-NOTES-227 — the transport on the graph's own edge.
 *
 * Bringing the graph up against the header (INV-NOTES-226) puts the playback
 * bar off the top of the page, and hearing the note being corrected is most
 * of why it is being corrected at all. It is the same transport as that bar,
 * not a rival to it, so it is here whenever the take is.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';

import { ThemeProvider } from '../../../theme';
import { TrackRail } from '../TrackRail';
import { DEFAULT_MIX } from '../playbackTracks';
import type { RailTransportProps } from '../RailTransport';

/** As much of a shared value as a clock reads. */
const held = (value: number) => ({ value }) as SharedValue<number>;

const onPlay = jest.fn();
const onPause = jest.fn();
const onRewind = jest.fn();

const transportOf = (
  state: RailTransportProps['state']
): RailTransportProps => ({
  state,
  positionMs: held(0),
  onPlay,
  onPause,
  onRewind
});

const setup = async (transport: RailTransportProps | null) =>
  waitFor(() =>
    render(
      <ThemeProvider>
        <TrackRail
          tracks={['take']}
          mix={DEFAULT_MIX}
          height={300}
          onToggle={jest.fn()}
          isSnapping
          onSnapping={jest.fn()}
          onOptions={jest.fn()}
          transport={transport}
        />
      </ThemeProvider>
    )
  );

beforeEach(() => {
  onPlay.mockReset();
  onPause.mockReset();
  onRewind.mockReset();
});

it('is on the rail whether or not a sheet is open', async () => {
  // A control that comes and goes is one you cannot reach for without
  // looking. The bar above the graph is the same transport, not a rival.
  const view = await setup(transportOf('stopped'));
  expect(view.getByTestId('rail-transport')).toBeTruthy();
});

it('is absent from a note with no take to play', async () => {
  const view = await setup(null);
  expect(view.queryByTestId('rail-transport')).toBeNull();
});

it('ACC-NOTES-241: pauses the take where it reached rather than stopping it', async () => {
  const view = await setup(transportOf('playing'));
  await fireEvent.press(view.getByTestId('rail-playback-button'));
  expect(onPause).toHaveBeenCalled();
  expect(onPlay).not.toHaveBeenCalled();
});

it('starts the take when it is not running', async () => {
  const view = await setup(transportOf('stopped'));
  await fireEvent.press(view.getByTestId('rail-playback-button'));
  expect(onPlay).toHaveBeenCalled();
});

it('goes back to the beginning', async () => {
  const view = await setup(transportOf('playing'));
  await fireEvent.press(view.getByTestId('rail-rewind'));
  expect(onRewind).toHaveBeenCalled();
});

it('shows the moment reached under the control', async () => {
  const view = await setup(transportOf('playing'));
  expect(view.getByTestId('rail-clock')).toBeTruthy();
});
