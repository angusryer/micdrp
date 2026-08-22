/**
 * Choosing how to see a take — INV-NOTES-026, ACC-NOTES-036.
 *
 * The sibling of HearItAs.test, and for the same reason: a complaint about the
 * picture should stop being ambiguous between the detector and the quantizer.
 *
 * `await waitFor(() => render(...))` before any query, matching HearItAs — a
 * bare render leaves the queries unbound in this setup.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { SeeItAs } from '../SeeItAs';

const setup = async (over: Partial<React.ComponentProps<typeof SeeItAs>> = {}) => {
  const onChange = jest.fn();
  const utils = await waitFor(() =>
    render(
      <ThemeProvider>
        <SeeItAs view="as-sung" onChange={onChange} canNotate {...over} />
      </ThemeProvider>
    )
  );
  return { ...utils, onChange };
};

describe('SeeItAs', () => {
  it('offers both readings', async () => {
    const { getByTestId } = await setup();
    expect(getByTestId('see-as-sung')).toBeTruthy();
    expect(getByTestId('see-as-notated')).toBeTruthy();
  });

  it('ACC-NOTES-036: switches to the written reading when asked', async () => {
    const { getByTestId, onChange } = await setup();
    await fireEvent.press(getByTestId('see-as-notated'));
    expect(onChange).toHaveBeenCalledWith('as-notated');
  });

  it('will not offer notation for a take that has no grid', async () => {
    // Offering it would promise something the take cannot answer.
    const { getByTestId, onChange } = await setup({ canNotate: false });
    await fireEvent.press(getByTestId('see-as-notated'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says which reading is drawn, so the difference is attributable', async () => {
    // Rendered fresh rather than rerendered: rerender is async in this setup
    // too, and a stale query reads as a missing element.
    const sung = await setup({ view: 'as-sung' });
    expect(sung.getByText('drawn where each note was sung')).toBeTruthy();

    const written = await setup({ view: 'as-notated' });
    expect(written.getByText('drawn on the grid, at notated lengths')).toBeTruthy();
  });
});
