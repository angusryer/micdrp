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
    expect(screen.getByTestId('pickup-0').props.accessibilityState).toMatchObject(
      { selected: true }
    );
  });

  it('ACC-NOTES-226: takes a pickup of two beats', async () => {
    const onSet = await show({ beats: 0 });
    void fireEvent.press(screen.getByTestId('pickup-2'));
    expect(onSet).toHaveBeenCalledWith(2);
  });
});

describe('a take with a pickup', () => {
  it('says how far in the singing starts', async () => {
    await show({ beats: 2 });
    expect(screen.getByText(/starts 2 beats before the first full bar/)).toBeTruthy();
  });

  it('can be taken back to a downbeat', async () => {
    const onSet = await show({ beats: 2 });
    void fireEvent.press(screen.getByTestId('pickup-0'));
    expect(onSet).toHaveBeenCalledWith(0);
  });
});

describe('what a pickup may be', () => {
  it('is less than a bar, because a whole bar is an earlier downbeat', async () => {
    await show({ beatsPerBar: 4 });
    expect(screen.getByTestId('pickup-3')).toBeTruthy();
    expect(screen.queryByTestId('pickup-4')).toBeNull();
  });

  it('follows the bar it is a part of', async () => {
    await show({ beatsPerBar: 3 });
    expect(screen.getByTestId('pickup-2')).toBeTruthy();
    expect(screen.queryByTestId('pickup-3')).toBeNull();
  });

  it('is not asked about at all where a bar holds one beat', async () => {
    await show({ beatsPerBar: 1 });
    // A bar of one beat cannot have a note before its own downbeat.
    expect(screen.queryByTestId('pickup-0')).toBeNull();
  });
});

describe('how a pickup is written down', () => {
  it('says it the way a person would', () => {
    expect(pickupLabel(0)).toBe('None');
    expect(pickupLabel(1)).toBe('1 beat');
    expect(pickupLabel(3)).toBe('3 beats');
  });
});
