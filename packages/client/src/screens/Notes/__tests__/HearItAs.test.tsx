/**
 * Choosing how to hear a take — INV-NOTES-026.
 *
 * The reason both exist is that a complaint about playback should stop being
 * ambiguous between the detector and the notation.
 *
 * Only the choice is here now: it is a row in the playback options, and the
 * control that sounds it stayed under the graph (MelodyPlayToggle.test).
 *
 * `await waitFor(() => render(...))` before any query, matching ChordCard —
 * a bare render leaves the queries unbound in this setup.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { HearItAs } from '../HearItAs';

const setup = async (over: Partial<React.ComponentProps<typeof HearItAs>> = {}) => {
  const onChange = jest.fn();
  const utils = await waitFor(() =>
    render(
      <ThemeProvider>
        <HearItAs mode="as-sung" onChange={onChange} canNotate {...over} />
      </ThemeProvider>
    )
  );
  return { ...utils, onChange };
};

describe('HearItAs', () => {
  it('offers both readings', async () => {
    const { getByTestId } = await setup();
    expect(getByTestId('hear-as-sung')).toBeTruthy();
    expect(getByTestId('hear-as-notated')).toBeTruthy();
  });

  it('switches to the other reading when asked', async () => {
    const { getByTestId, onChange } = await setup();
    await fireEvent.press(getByTestId('hear-as-notated'));
    expect(onChange).toHaveBeenCalledWith('as-notated');
  });

  it('is a toggle in the list, saying which surface it is for', async () => {
    // Two rows put "As sung" in the sheet twice, so what tells them apart is
    // the row — visible on screen, and said aloud so it is not lost.
    const { getByText, getByRole } = await setup();
    expect(getByText('Hear')).toBeTruthy();
    expect(
      getByRole('radio', { name: 'Hear as sung', selected: true })
    ).toBeTruthy();
    expect(
      getByRole('radio', { name: 'Hear as written', selected: false })
    ).toBeTruthy();
  });

  it('will not offer notation for a take that has no grid', async () => {
    // Offering it would promise something the take cannot answer.
    const { getByTestId, onChange } = await setup({ canNotate: false });
    await fireEvent.press(getByTestId('hear-as-notated'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says which reading is playing, so the difference is attributable', async () => {
    // Rendered fresh rather than rerendered: rerender is async in this setup
    // too, and a stale query reads as a missing element.
    const sung = await setup({ mode: 'as-sung' });
    expect(sung.getByText('exact pitch and timing detected')).toBeTruthy();

    const notated = await setup({ mode: 'as-notated' });
    expect(notated.getByText('snapped to notes and beats')).toBeTruthy();
  });
});
