/**
 * INV-NOTES-109 — the page can be scrolled clear of the sheet over it.
 *
 * The selection sheet is deliberately undimmed and non-modal, so the graph
 * stays live behind it (INV-NOTES-078). That promise is only kept if the page
 * can also be *reached*: with the sheet up, the bottom of the column sat under
 * it, and scrolling there sprang straight back — the content ended where it
 * always had, so there was nothing below to scroll to.
 *
 * What this pins is that the sheet reports how much it covered and the page
 * keeps that much room at its foot.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { SelectionSheet } from '../SelectionSheet';
import type { Chosen } from '../../../components/graphSelection';

jest.mock('../SelectionBody', () => {
  const { View: Stub } = require('react-native');
  return { SelectionBody: () => <Stub testID="body" /> };
});

const detail = {} as never;

const show = (selection: Chosen, onCover: (name: string, px: number) => void) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <SelectionSheet
          detail={detail}
          selection={selection}
          onSelect={jest.fn()}
          onCover={onCover}
        />
      </ThemeProvider>
    </I18nProvider>
  );

const CHOSEN: Chosen = [{ kind: 'melodyNote', index: 0 }];

/** Where the mock sheet claims to have settled (see jest.setup). */
const settleAt = (y: number) => {
  (globalThis as unknown as { TRUE_SHEET_POSITION: number }).TRUE_SHEET_POSITION =
    y;
};

const screenHeight = Dimensions.get('window').height;

describe('the room the selection sheet takes', () => {
  it('reports what it covered, measured from where it settled', async () => {
    // Whatever it settled at, what it covers is the screen below that.
    const onCover = jest.fn();
    settleAt(500);
    await show(CHOSEN, onCover);

    expect(onCover).toHaveBeenCalledWith('selection', screenHeight - 500);
  });

  it('measures rather than assumes, since its height follows its content', async () => {
    const onCover = jest.fn();
    settleAt(300);
    await show(CHOSEN, onCover);

    // A taller sheet settles higher and asks for more room, by the same rule.
    expect(onCover).toHaveBeenCalledWith('selection', screenHeight - 300);
  });

  it('gives the room back when it goes', async () => {
    const onCover = jest.fn();
    settleAt(500);
    const view = await show(CHOSEN, onCover);
    onCover.mockClear();

    await act(async () => {
      await view.rerender(
        <I18nProvider>
          <ThemeProvider>
            <SelectionSheet
              detail={detail}
              selection={[]}
              onSelect={jest.fn()}
              onCover={onCover}
            />
          </ThemeProvider>
        </I18nProvider>
      );
    });

    expect(onCover).toHaveBeenCalledWith('selection', 0);
  });

  it('never asks for negative room', async () => {
    // A sheet reported as settling below the screen would otherwise subtract
    // room from the page rather than adding it.
    const onCover = jest.fn();
    settleAt(screenHeight * 2);
    await show(CHOSEN, onCover);

    expect(onCover).toHaveBeenCalledWith('selection', 0);
    expect(screen.queryByTestId('body')).not.toBeNull();
  });
});
