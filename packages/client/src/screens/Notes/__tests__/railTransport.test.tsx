/**
 * ACC-NOTES-241, ACC-NOTES-243 / INV-NOTES-227, INV-NOTES-229 — the foot of
 * the rail: where the take is played from, and the one door to what governs
 * the graph from outside it.
 *
 * The transport began as a repeat of the bar above the graph. Two controls
 * for one transport is two things to keep in step for no gain, and the bar
 * was the one out of reach — bringing the graph up against the header
 * (INV-NOTES-226) scrolls it away.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { TrackRail } from '../TrackRail';
import { DEFAULT_MIX } from '../playbackTracks';
import type { RailFootProps } from '../RailFoot';

/** As much of a shared value as a clock reads. */
const held = (value: number) => ({ value }) as SharedValue<number>;

const onPlay = jest.fn();
const onPause = jest.fn();
const onRewind = jest.fn();
const onMenu = jest.fn();

const transportOf = (state: RailFootProps['state']): RailFootProps => ({
  state,
  positionMs: held(0),
  durationMs: 26_000,
  onPlay,
  onPause
});

const setup = async (transport: RailFootProps | null) =>
  waitFor(() =>
    render(
      <GestureHandlerRootView>
        <I18nProvider>
        <ThemeProvider>
        <TrackRail
          tracks={['take']}
          mix={DEFAULT_MIX}
          height={300}
          onToggle={jest.fn()}
          isSnapping
          onSnapping={jest.fn()}
          onMenu={onMenu}
          onRewind={transport != null ? onRewind : undefined}
          transport={transport}
        />
        </ThemeProvider>
        </I18nProvider>
      </GestureHandlerRootView>
    )
  );

beforeEach(() => {
  onPlay.mockReset();
  onPause.mockReset();
  onRewind.mockReset();
  onMenu.mockReset();
});

it('carries the transport at the foot of the column', async () => {
  const view = await setup(transportOf('stopped'));
  expect(view.getByTestId('rail-foot')).toBeTruthy();
});

it('is absent from a note with no take to play', async () => {
  const view = await setup(null);
  expect(view.queryByTestId('rail-foot')).toBeNull();
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

it('goes back to the beginning, from directly above the play control', async () => {
  const view = await setup(transportOf('playing'));
  await fireEvent.press(view.getByTestId('rail-rewind'));
  expect(onRewind).toHaveBeenCalled();
});

it('shows the moment reached beside the control', async () => {
  const view = await setup(transportOf('playing'));
  expect(view.getByTestId('rail-clock')).toBeTruthy();
});

it('ACC-NOTES-243: opens what governs the graph from one control', async () => {
  const view = await setup(transportOf('stopped'));
  await fireEvent.press(view.getByTestId('rail-menu'));
  expect(onMenu).toHaveBeenCalled();
  // And the two doors it replaced are gone from the rail itself.
  expect(view.queryByTestId('rail-options')).toBeNull();
});
