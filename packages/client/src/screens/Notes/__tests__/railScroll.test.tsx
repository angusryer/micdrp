/**
 * ACC-NOTES-248 / INV-NOTES-233 — the rail's switches scroll, and the doors
 * and the foot below them do not.
 *
 * The rail is as tall as the drawing beside it and no taller, but what it has
 * to hold does not depend on that height: a note with every track has more
 * switches than a short graph has room for.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { TrackRail } from '../TrackRail';
import { TRACK_ORDER } from '../playbackTracks';

/** Every track a note can have, all audible: the fullest rail there is. */
const EVERY = TRACK_ORDER;
const ALL_ON = Object.fromEntries(EVERY.map((t) => [t, true])) as never;

type View = Awaited<ReturnType<typeof render>>;

const setup = async (): Promise<View> =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <TrackRail
            tracks={EVERY}
            mix={ALL_ON}
            // Shorter than the switches need, which is the whole point.
            height={120}
            onToggle={jest.fn()}
            isSnapping={false}
            onSnapping={jest.fn()}
            onMenu={jest.fn()}
            onHelp={jest.fn()}
            onRewind={jest.fn()}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );

/** Whether a node has the scroll among its ancestors. */
const insideScroll = (view: View, testID: string): boolean => {
  const scroll = view.getByTestId('rail-switches');
  let node = view.getByTestId(testID).parent;
  while (node != null) {
    if (node === scroll) {
      return true;
    }
    node = node.parent;
  }
  return false;
};

it('ACC-NOTES-248: a rail too short for its tracks still offers every one', async () => {
  const view = await setup();
  for (const track of EVERY) {
    expect(view.getByTestId(`rail-${track}`)).toBeTruthy();
  }
});

it('ACC-NOTES-248: the switches and the grid are what scrolls', async () => {
  const view = await setup();
  for (const id of [...EVERY.map((t) => `rail-${t}`), 'rail-snap']) {
    expect(insideScroll(view, id)).toBe(true);
  }
});

it('ACC-NOTES-248: the doors and the rewind stay put', async () => {
  const view = await setup();
  for (const id of ['rail-menu', 'rail-help', 'rail-rewind']) {
    expect(insideScroll(view, id)).toBe(false);
  }
});
