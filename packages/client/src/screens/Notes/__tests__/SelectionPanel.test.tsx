/**
 * INV-NOTES-099 — sideways, the selection comes in beside the graph.
 *
 * Held sideways the short dimension is entirely graph, so a sheet rising from
 * the bottom covers the thing being worked on. The panel takes width instead,
 * which the sideways view has to spare.
 *
 * It also has no grabber to drag away, so putting the selection down has to be
 * offered somewhere — a panel that cannot be dismissed keeps the graph narrow
 * for the rest of the session.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { SelectionPanel } from '../SelectionPanel';

jest.mock('../SelectionBody', () => {
  const { View: Stub } = require('react-native');
  return { SelectionBody: () => <Stub testID="body" /> };
});

const detail = {} as never;

const show = (selection: unknown[], onSelect = jest.fn()) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <SelectionPanel
          detail={detail}
          selection={selection as never}
          onSelect={onSelect}
        />
      </ThemeProvider>
    </I18nProvider>
  );

describe('the sideways selection panel', () => {
  it('takes no room while nothing is chosen', async () => {
    await show([]);
    expect(screen.queryByTestId('selection-panel')).toBeNull();
  });

  it('shows the same content the upright sheet does', async () => {
    await show([{ kind: 'melodyNote', index: 0 }]);
    expect(screen.queryByTestId('body')).not.toBeNull();
  });

  it('can be put down, since there is no grabber to drag away', async () => {
    const onSelect = jest.fn();
    await show([{ kind: 'melodyNote', index: 0 }], onSelect);

    await fireEvent.press(screen.getByLabelText('Put the selection down'));
    expect(onSelect).toHaveBeenCalledWith([]);
  });
});
