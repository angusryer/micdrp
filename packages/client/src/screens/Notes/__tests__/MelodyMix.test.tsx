/**
 * How loudly the detected melody sits against the take — INV-NOTES-027.
 *
 * Whether it sounds at all is the melody's track toggle beside the play
 * control (playbackMix.test.tsx). What is left here is the level, and the
 * absence of a second switch for a decision the toggles already carry.
 *
 * `await waitFor(() => render(...))` before any query, and `await
 * fireEvent.press` — both are async in this setup.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider } from '../../../theme';
import { MelodyMix } from '../MelodyMix';

const setup = async (over: Partial<React.ComponentProps<typeof MelodyMix>> = {}) => {
  const onLevelChange = jest.fn();
  const utils = await waitFor(() =>
    render(
      <GestureHandlerRootView>
        <ThemeProvider>
          <MelodyMix level={0.5} onLevelChange={onLevelChange} {...over} />
        </ThemeProvider>
      </GestureHandlerRootView>
    )
  );
  return { ...utils, onLevelChange };
};

describe('MelodyMix', () => {
  it('offers the level whenever the melody has one to set', async () => {
    const { getByTestId } = await setup();
    expect(getByTestId('level-slider')).toBeTruthy();
  });

  it('carries no switch of its own for turning the melody on', async () => {
    const { queryByTestId, queryByLabelText } = await setup();
    expect(queryByTestId('hear-over-take')).toBeNull();
    expect(queryByLabelText('Play the melody over the recording')).toBeNull();
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
