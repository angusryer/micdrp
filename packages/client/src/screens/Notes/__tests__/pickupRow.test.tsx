/**
 * Making a count-in — INV-NOTES-250 and INV-NOTES-251.
 *
 * This used to test saying how far into a bar the singing began, which was
 * a measurement of the take rather than a statement about the music. The
 * count-in replaced it: play the take, tap the count, say how long it runs.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { PickupRow, pickupLabel } from '../PickupRow';

/** A pass of taps at a steady 500ms, played back to the row on demand. */
const STEADY = [0, 500, 1000, 1500, 2000];

const show = async (
  props: Partial<React.ComponentProps<typeof PickupRow>> = {}
) => {
  const onMake = jest.fn();
  const onPlay = jest.fn();
  const onStop = jest.fn();
  const onClear = jest.fn();
  let next = 0;
  await waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <PickupRow
            pickup={null}
            onPlay={onPlay}
            onStop={onStop}
            atMs={() => STEADY[next++] ?? 0}
            onMake={onMake}
            onClear={onClear}
            {...props}
          />
        </ThemeProvider>
      </I18nProvider>
    )
  );
  return { onMake, onPlay, onStop, onClear };
};

/**
 * A press, and the render it causes.
 *
 * Rendering is asynchronous here, so a press followed straight away by a
 * query looks at the tree as it was before the press — which reads as a
 * control that is not there rather than as a test racing the renderer.
 */
const press = async (testID: string): Promise<void> => {
  await act(async () => {
    await fireEvent.press(screen.getByTestId(testID));
  });
};

const tapTimes = async (n: number): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < n; i += 1) {
      await fireEvent(screen.getByTestId('pickup-tap'), 'pressIn');
    }
  });
};

describe('the count-in row', () => {
  it('says a take has none until somebody makes one', async () => {
    await show();
    expect(screen.getByText(/Nothing counts you in/)).toBeTruthy();
  });

  it('plays the take when the count is begun', async () => {
    const { onPlay } = await show();
    await press('pickup-begin');
    expect(onPlay).toHaveBeenCalled();
  });

  it('stops the take when the pass ends', async () => {
    const { onStop } = await show();
    await press('pickup-begin');
    await press('pickup-stop');
    expect(onStop).toHaveBeenCalled();
  });

  it('asks how long the count runs, once a pulse is there', async () => {
    await show();
    await press('pickup-begin');
    await tapTimes(STEADY.length);
    await press('pickup-stop');
    expect(screen.getByText(/120 bpm/)).toBeTruthy();
  });

  it('makes the count with the taps and the beats asked for', async () => {
    const { onMake } = await show();
    await press('pickup-begin');
    await tapTimes(STEADY.length);
    await press('pickup-stop');
    await press('pickup-beats-4');
    expect(onMake).toHaveBeenCalledWith(STEADY, 4);
  });

  it('says so rather than guessing when a pass is too short', async () => {
    await show();
    await press('pickup-begin');
    await tapTimes(1);
    await press('pickup-stop');
    expect(screen.getByText(/Too few taps/)).toBeTruthy();
  });

  it('describes a count that has been made', async () => {
    await show({ pickup: { beats: 4, beatMs: 500, endMs: 0 } });
    expect(screen.getByText(/4 beats at 120 bpm/)).toBeTruthy();
  });

  it('offers to take a made count away', async () => {
    const { onClear } = await show({
      pickup: { beats: 2, beatMs: 500, endMs: 0 }
    });
    await press('pickup-clear');
    expect(onClear).toHaveBeenCalled();
  });
});

describe('pickupLabel', () => {
  it('counts in beats, and says none for nothing', () => {
    expect(pickupLabel(0)).toBe('None');
    expect(pickupLabel(1)).toBe('1 beat');
    expect(pickupLabel(3)).toBe('3 beats');
  });
});
