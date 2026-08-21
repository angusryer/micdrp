/**
 * Mixing the detected melody against the take — INV-NOTES-027.
 *
 * `await waitFor(() => render(...))` before any query, and `await
 * fireEvent.press` — both are async in this setup.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider } from '../../../theme';
import { MelodyMix } from '../MelodyMix';

const setup = async (over: Partial<React.ComponentProps<typeof MelodyMix>> = {}) => {
  const onOverTakeChange = jest.fn();
  const onLevelChange = jest.fn();
  const utils = await waitFor(() =>
    render(
      <GestureHandlerRootView>
        <ThemeProvider>
          <MelodyMix
            isOverTake
            onOverTakeChange={onOverTakeChange}
            level={0.5}
            onLevelChange={onLevelChange}
            {...over}
          />
        </ThemeProvider>
      </GestureHandlerRootView>
    )
  );
  return { ...utils, onOverTakeChange, onLevelChange };
};

describe('MelodyMix', () => {
  it('turns hearing them together on and off', async () => {
    const { getByTestId, onOverTakeChange } = await setup({ isOverTake: false });
    await fireEvent(getByTestId('hear-over-take'), 'valueChange', true);
    expect(onOverTakeChange).toHaveBeenCalledWith(true);
  });

  it('offers no level to set when nothing is playing over the take', async () => {
    const { queryByTestId } = await setup({ isOverTake: false });
    expect(queryByTestId('level-slider')).toBeNull();
  });

  it('shows a slider once something is playing over the take', async () => {
    const { getByTestId } = await setup({ isOverTake: true });
    expect(getByTestId('level-slider')).toBeTruthy();
  });

  it('reports where the level sits, for a screen reader too', async () => {
    const { getByTestId } = await setup({ level: 0.3 });
    expect(getByTestId('level-slider').props.accessibilityValue).toMatchObject({
      now: 30
    });
  });

  it('says how loud it is', async () => {
    const { getByText } = await setup({ level: 0.3 });
    expect(getByText('30%')).toBeTruthy();
  });
});
