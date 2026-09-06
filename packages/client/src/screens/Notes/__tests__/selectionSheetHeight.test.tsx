/**
 * ACC-NOTES-221 / INV-NOTES-078 — choosing a thing never puts a sheet
 * between you and it.
 *
 * Undimmed was already true and is not enough on its own. Sized to its own
 * content the sheet rose as far as that content asked for, and a tall
 * selection covered the graph as completely as dimming it would have: the
 * background is live and there is nothing left of it to see. The change
 * being made is on the graph, which is the reason the sheet is open.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// What is in the sheet is not what this is about — the same stub the
// sideways panel's test uses, for the same reason.
jest.mock('../SelectionBody', () => {
  const { View: Stub } = require('react-native');
  return { SelectionBody: () => <Stub testID="body" /> };
});

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { SelectionSheet } from '../SelectionSheet';

const detail = {} as never;

const open = () =>
  waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <SelectionSheet
            detail={detail}
            selection={[{ kind: 'melodyNote', index: 0 }] as never}
            onSelect={jest.fn()}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );

/** What the sheet was asked to be — its height and its dimming. */
const sheetProps = () =>
  (
    globalThis as unknown as {
      TRUE_SHEET_PROPS: Record<
        string,
        { detents: (number | string)[]; dimmed?: boolean }
      >;
    }
  ).TRUE_SHEET_PROPS.selection;

describe('the selection sheet', () => {
  it('ACC-NOTES-221: opens part way, leaving the graph in view', async () => {
    await open();
    const first = sheetProps().detents[0];
    expect(typeof first).toBe('number');
    expect(first as number).toBeLessThan(0.5);
  });

  it('can be dragged taller for anyone who wants it there', async () => {
    await open();
    const { detents } = sheetProps();
    expect(detents.length).toBeGreaterThan(1);
    expect(detents[detents.length - 1] as number).toBeGreaterThan(
      detents[0] as number
    );
  });

  it('leaves the graph live behind it, as it always did', async () => {
    await open();
    expect(sheetProps().dimmed).toBe(false);
  });
});
