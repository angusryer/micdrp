/**
 * INV-NOTES-129 — tapping a rhythm in.
 *
 * The moment a finger lands is the moment. Nothing is detected and nothing can
 * be mistaken for anything else, which makes this the most certain input the
 * app has — and it works in a noisy room, and for a part nobody can sing.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { TapPad } from '../TapPad';

type Props = React.ComponentProps<typeof TapPad>;

const show = (over: Partial<Props> = {}) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <TapPad onTap={jest.fn()} isArmed count={0} {...over} />
      </ThemeProvider>
    </I18nProvider>
  );

describe('the tap pad', () => {
  it('offers a pad per sound, low to high as the band draws them', async () => {
    // One pad could only ever record a pulse; a rhythm is a conversation
    // between a low sound and a high one.
    await show();
    expect(screen.queryByLabelText('Tap a thump')).not.toBeNull();
    expect(screen.queryByLabelText('Tap a tap')).not.toBeNull();
    expect(screen.queryByLabelText('Tap a hiss')).not.toBeNull();
  });

  it('lays one down as the finger lands, not as it lifts', async () => {
    // Waiting for the release would put every hit late by however long the
    // pad was held.
    const onTap = jest.fn();
    await show({ onTap });

    await fireEvent(screen.getByLabelText('Tap a thump'), 'pressIn');

    expect(onTap).toHaveBeenCalledWith('thump');
  });

  it('says which sound each pad lays down', async () => {
    const onTap = jest.fn();
    await show({ onTap });

    await fireEvent(screen.getByLabelText('Tap a hiss'), 'pressIn');

    expect(onTap).toHaveBeenCalledWith('hiss');
  });

  it('lays nothing down when there is no moment to tap against', async () => {
    const onTap = jest.fn();
    await show({ onTap, isArmed: false });

    await fireEvent(screen.getByLabelText('Tap a thump'), 'pressIn');

    expect(onTap).not.toHaveBeenCalled();
  });

  it('says what to do when nothing is playing', async () => {
    await show({ isArmed: false });
    expect(screen.queryByText(/Play the take/)).not.toBeNull();
  });

  it('offers to start over only once there is something to throw away', async () => {
    const bare = await show({ count: 0, onClear: jest.fn() });
    expect(bare.queryByLabelText('Throw away what was tapped')).toBeNull();
    await bare.unmount();

    const some = await show({ count: 4, onClear: jest.fn() });
    expect(
      some.queryByLabelText('Throw away what was tapped')
    ).not.toBeNull();
    expect(some.queryByText('4 tapped')).not.toBeNull();
  });
});
