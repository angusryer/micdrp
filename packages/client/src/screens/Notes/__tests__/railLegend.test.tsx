/**
 * ACC-NOTES-247 / INV-NOTES-232 — the rail can be read rather than guessed at.
 *
 * A column 38 points wide says everything in letters and glyphs, which is a
 * reminder to whoever already knows and nothing at all to whoever does not.
 * The question mark under the menu is where the knowing comes from.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { RailLegend } from '../RailLegend';
import { TrackRail } from '../TrackRail';
import { TRACK_TITLES } from '../playbackTracks';

const wrap = (node: React.ReactNode) =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>{node}</ThemeProvider>
      </I18nProvider>
    )
  );

it('ACC-NOTES-247: the question mark on the rail opens it', async () => {
  const onHelp = jest.fn();
  const view = await wrap(
    <TrackRail
      tracks={['take', 'melody']}
      mix={{ take: true, melody: false } as never}
      height={300}
      onToggle={jest.fn()}
      isSnapping={false}
      onSnapping={jest.fn()}
      onMenu={jest.fn()}
      onHelp={onHelp}
    />
  );
  await fireEvent.press(view.getByTestId('rail-help'));
  expect(onHelp).toHaveBeenCalled();
});

it('ACC-NOTES-247: names every mark on the rail and in its foot', async () => {
  const view = await wrap(
    <RailLegend
      isOpen
      onClose={jest.fn()}
      tracks={['take', 'chords', 'melody']}
      hasTransport
      hasActs
    />
  );

  // The tracks the note has, by the names the options give them.
  for (const track of ['take', 'chords', 'melody'] as const) {
    expect(view.getByText(TRACK_TITLES[track])).toBeTruthy();
  }

  // Everything else drawn on the column, top to bottom, and then along the
  // foot: the grid, the menu, this, the rewind, the transport, the handle,
  // and each act behind it.
  for (const said of [
    'The grid',
    'The menu',
    'This',
    'Back to the beginning',
    'Play, and pause',
    'How far in you are',
    'The handle',
    'Sing a bass line under this',
    'Read the take again',
    'The chords, on the graph'
  ]) {
    expect(view.getByText(said)).toBeTruthy();
  }
});

it('ACC-NOTES-247: says nothing about a track the note does not have', async () => {
  const view = await wrap(
    <RailLegend isOpen onClose={jest.fn()} tracks={['take']} hasTransport hasActs />
  );
  expect(view.queryByText(TRACK_TITLES.bass)).toBeNull();
});

it('ACC-NOTES-247: the foot is described only where there is one', async () => {
  const view = await wrap(
    <RailLegend isOpen onClose={jest.fn()} tracks={['take']} />
  );
  expect(view.queryByText('The handle')).toBeNull();
  expect(view.queryByText('Read the take again')).toBeNull();
  // What is always there is still said.
  expect(view.getByText('The grid')).toBeTruthy();
});
