/**
 * ACC-NOTES-226 / INV-NOTES-211 — saying how long the pickup is.
 *
 * It could only be changed by dragging the first bar line, which holds that
 * line between its neighbours: it resized the first bar instead of shifting
 * the music, so saying "this take has a two-beat pickup" meant dragging every
 * line in turn and hoping they stayed even.
 *
 * It sits beside the tap pattern because they are the same kind of sentence —
 * both say where the bar sits, and neither is a reading of the take.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { PickupRow, pickupLabel } from '../PickupRow';

const show = async (
  props: Partial<React.ComponentProps<typeof PickupRow>> = {}
) => {
  const onSet = jest.fn();
  await waitFor(() =>
    render(
      <I18nProvider>
        <ThemeProvider>
          <PickupRow beats={0} beatsPerBar={4} onSet={onSet} {...props} />
        </ThemeProvider>
      </I18nProvider>
    )
  );
  return onSet;
};

describe('a take that opens on a downbeat', () => {
  it('says so, rather than calling it a pickup of no length', async () => {
    await show({ beats: 0 });
    expect(screen.getByText(/opens on a downbeat/)).toBeTruthy();
    expect(screen.getByTestId('pickup-beats')).toHaveTextContent('0');
  });

  it('ACC-NOTES-226: lengthens the pickup a beat at a time', async () => {
    const onSet = await show({ beats: 1 });
    void fireEvent.press(screen.getByTestId('pickup-beats-up'));
    expect(onSet).toHaveBeenCalledWith(2);
  });

  it('will not go below no pickup at all', async () => {
    const onSet = await show({ beats: 0 });
    void fireEvent.press(screen.getByTestId('pickup-beats-down'));
    expect(onSet).not.toHaveBeenCalled();
  });
});

describe('a take with a pickup', () => {
  it('says how far in the singing starts', async () => {
    await show({ beats: 2 });
    expect(screen.getByText(/starts 2 beats before the first full bar/)).toBeTruthy();
  });

  it('can be taken back towards a downbeat', async () => {
    const onSet = await show({ beats: 1 });
    void fireEvent.press(screen.getByTestId('pickup-beats-down'));
    expect(onSet).toHaveBeenCalledWith(0);
  });

  it('says what the number means, not just the number', async () => {
    await show({ beats: 2 });
    expect(screen.queryByLabelText('A pickup of 2 beats')).not.toBeNull();
  });
});

describe('what a pickup may be', () => {
  it('is less than a bar, because a whole bar is an earlier downbeat', async () => {
    const onSet = await show({ beats: 3, beatsPerBar: 4 });
    void fireEvent.press(screen.getByTestId('pickup-beats-up'));
    expect(onSet).not.toHaveBeenCalled();
  });

  it('follows the bar it is a part of', async () => {
    const onSet = await show({ beats: 2, beatsPerBar: 3 });
    void fireEvent.press(screen.getByTestId('pickup-beats-up'));
    expect(onSet).not.toHaveBeenCalled();

    const longer = await show({ beats: 2, beatsPerBar: 6 });
    void fireEvent.press(screen.getByTestId('pickup-beats-up'));
    expect(longer).toHaveBeenCalledWith(3);
  });

  it('is not asked about at all where a bar holds one beat', async () => {
    await show({ beatsPerBar: 1 });
    // A bar of one beat cannot have a note before its own downbeat.
    expect(screen.queryByTestId('pickup-beats')).toBeNull();
  });
});

describe('how a pickup is written down', () => {
  it('says it the way a person would', () => {
    expect(pickupLabel(0)).toBe('None');
    expect(pickupLabel(1)).toBe('1 beat');
    expect(pickupLabel(3)).toBe('3 beats');
  });
});
