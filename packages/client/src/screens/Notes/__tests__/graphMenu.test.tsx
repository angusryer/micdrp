/**
 * ACC-NOTES-243 / INV-NOTES-229 — one control opens everything that governs
 * the graph, and it opens out of the rail rather than up from the bottom of
 * the screen.
 *
 * What it offers belongs to the graph. A sheet rising over the page says the
 * opposite: it covers the thing being worked on, and it is the gesture
 * already spoken for by the analysis and the selection.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { GraphMenu } from '../GraphMenu';
import { TRACK_RAIL_WIDTH } from '../TrackRail';

const onClose = jest.fn();
const onOptions = jest.fn();
const onDetails = jest.fn();

const setup = async (isOpen = true) =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <GraphMenu
            isOpen={isOpen}
            onClose={onClose}
            fromX={TRACK_RAIL_WIDTH}
            fromBottom={100}
            onOptions={onOptions}
            onDetails={onDetails}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );

/** The panel's flattened style, whichever way it was composed. */
const shapeOf = (style: unknown): Record<string, unknown> =>
  Array.isArray(style)
    ? (Object.assign({}, ...style.flat()) as Record<string, unknown>)
    : (style as Record<string, unknown>);

beforeEach(() => {
  onClose.mockReset();
  onOptions.mockReset();
  onDetails.mockReset();
});

it('ACC-NOTES-243: offers what each track sounds at', async () => {
  const view = await setup();
  await fireEvent.press(view.getByTestId('menu-options'));
  expect(onOptions).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('ACC-NOTES-243: offers the take’s analysis', async () => {
  const view = await setup();
  await fireEvent.press(view.getByTestId('menu-analysis'));
  expect(onDetails).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('comes out of the rail, level with the control that opened it', async () => {
  const view = await setup();
  const panel = shapeOf(view.getByTestId('graph-menu').props.style);
  // Against the rail's edge rather than over it, and at the height of the
  // control rather than near it.
  expect(panel.left).toBe(TRACK_RAIL_WIDTH);
  expect(panel.bottom).toBe(100);
  expect(panel.position).toBe('absolute');
});

it('closes on a touch anywhere else', async () => {
  const view = await setup();
  await fireEvent.press(view.getByTestId('menu-scrim'));
  expect(onClose).toHaveBeenCalled();
});

it('is not in the way while it is closed', async () => {
  const view = await setup(false);
  // Not merely invisible: a scrim over the graph would swallow every touch
  // meant for the notes under it.
  expect(view.queryByTestId('graph-menu')).toBeNull();
  expect(view.queryByTestId('menu-scrim')).toBeNull();
});
