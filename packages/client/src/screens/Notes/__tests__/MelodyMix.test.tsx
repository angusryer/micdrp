/**
 * Mixing the detected melody against the take — INV-NOTES-027.
 *
 * `await waitFor(() => render(...))` before any query, and `await
 * fireEvent.press` — both are async in this setup.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';
import { MelodyMix } from '../MelodyMix';

const setup = async (over: Partial<React.ComponentProps<typeof MelodyMix>> = {}) => {
  const onOverTakeChange = jest.fn();
  const onLevelChange = jest.fn();
  const utils = await waitFor(() =>
    render(
      <ThemeProvider>
        <MelodyMix
          isOverTake
          onOverTakeChange={onOverTakeChange}
          level={0.5}
          onLevelChange={onLevelChange}
          {...over}
        />
      </ThemeProvider>
    )
  );
  return { ...utils, onOverTakeChange, onLevelChange };
};

describe('MelodyMix', () => {
  it('turns hearing them together on and off', async () => {
    const { getByTestId, onOverTakeChange } = await setup({ isOverTake: false });
    await fireEvent.press(getByTestId('hear-over-take'));
    expect(onOverTakeChange).toHaveBeenCalledWith(true);
  });

  it('offers no level to set when nothing is playing over the take', async () => {
    const { queryByTestId } = await setup({ isOverTake: false });
    expect(queryByTestId('hear-level-up')).toBeNull();
  });

  it('makes the melody louder and quieter', async () => {
    const { getByTestId, onLevelChange } = await setup({ level: 0.5 });
    await fireEvent.press(getByTestId('hear-level-up'));
    expect(onLevelChange).toHaveBeenCalledWith(expect.closeTo(0.6, 5));

    const down = await setup({ level: 0.5 });
    await fireEvent.press(down.getByTestId('hear-level-down'));
    expect(down.onLevelChange).toHaveBeenCalledWith(expect.closeTo(0.4, 5));
  });

  it('stops at silent rather than going below it', async () => {
    const { getByTestId, onLevelChange } = await setup({ level: 0 });
    await fireEvent.press(getByTestId('hear-level-down'));
    expect(onLevelChange).not.toHaveBeenCalled();
  });

  it('stops at full rather than going past it', async () => {
    const { getByTestId, onLevelChange } = await setup({ level: 1 });
    await fireEvent.press(getByTestId('hear-level-up'));
    expect(onLevelChange).not.toHaveBeenCalled();
  });

  it('says how loud it is', async () => {
    const { getByText } = await setup({ level: 0.3 });
    expect(getByText('30%')).toBeTruthy();
  });
});
