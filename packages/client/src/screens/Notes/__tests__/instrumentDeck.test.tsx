/**
 * ACC-NOTES-244 / INV-NOTES-151 — the instruments under the graph.
 *
 * A guitar neck today, a piano next, and whatever else a line is worth
 * hearing on. What holds them is a row rather than one drawing with a control
 * to hide it: "which instrument am I working this out on" is the question
 * that control was standing in for.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { InstrumentDeck } from '../InstrumentDeck';

const setup = async () =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <InstrumentDeck width={320}>
            <Text>a guitar neck</Text>
          </InstrumentDeck>
        </ThemeProvider>
      </I18nProvider>
    )
  );

it('ACC-NOTES-244: opens on the instrument it was given', async () => {
  const view = await setup();
  expect(view.getByText('a guitar neck')).toBeTruthy();
});

it('settles on one instrument at a time', async () => {
  const view = await setup();
  const deck = view.getByTestId('instrument-deck');
  // Half an instrument is one you can neither read nor use, and half of two
  // is worse than one.
  expect(deck.props.pagingEnabled).toBe(true);
  expect(deck.props.horizontal).toBe(true);
});

it('says what is coming rather than ending on an empty edge', async () => {
  const view = await setup();
  expect(view.getByText('More instruments coming')).toBeTruthy();
});
