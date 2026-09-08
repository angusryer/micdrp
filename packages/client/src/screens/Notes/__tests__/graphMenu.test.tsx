/**
 * ACC-NOTES-243 / INV-NOTES-229 — one control opens everything that governs
 * the graph.
 *
 * They were two glyphs in two places — one at the foot of the rail, one above
 * the drawing — and neither said what it was.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { GraphMenuSheet } from '../GraphMenuSheet';

const onClose = jest.fn();
const onOptions = jest.fn();
const onDetails = jest.fn();

const setup = async () =>
  waitFor(() =>
    render(
      <ThemeProvider>
        <GraphMenuSheet
          isOpen
          onClose={onClose}
          onOptions={onOptions}
          onDetails={onDetails}
        />
      </ThemeProvider>
    )
  );

beforeEach(() => {
  onClose.mockReset();
  onOptions.mockReset();
  onDetails.mockReset();
});

it('ACC-NOTES-243: offers what each track sounds at', async () => {
  const view = await setup();
  await fireEvent.press(view.getByTestId('menu-options'));
  expect(onOptions).toHaveBeenCalled();
  // Closed on the way: both of these are sheets, and one raised over another
  // leaves the first to be dismissed twice.
  expect(onClose).toHaveBeenCalled();
});

it('ACC-NOTES-243: offers the take’s analysis', async () => {
  const view = await setup();
  await fireEvent.press(view.getByTestId('menu-analysis'));
  expect(onDetails).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('says what each one is, rather than drawing a glyph for it', async () => {
  const view = await setup();
  // These are read once and then not thought about again, which is what
  // words are for and glyphs are not (INV-NOTES-086).
  expect(view.getByText('Levels and voices')).toBeTruthy();
  expect(view.getByText('Analysis')).toBeTruthy();
});
