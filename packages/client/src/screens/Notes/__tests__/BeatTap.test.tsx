/**
 * INV-NOTES-130 — tapping the beat.
 *
 * One button, because there is one thing being said: here is the beat. Three
 * pads were a drum machine, which is a different instrument and a different
 * question — the pulse is singular.
 *
 * Armed only while the take is sounding. A tap against a stopped transport has
 * no moment to be at, so it would land wherever the playhead was left, which
 * is a beat placed by accident.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { BeatTap } from '../BeatTap';

type Props = React.ComponentProps<typeof BeatTap>;

const show = (over: Partial<Props> = {}) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <BeatTap onTap={jest.fn()} isArmed count={0} {...over} />
      </ThemeProvider>
    </I18nProvider>
  );

describe('the beat tap', () => {
  it('is one button, not a kit', async () => {
    await show();
    expect(screen.queryByLabelText('Tap the beat')).not.toBeNull();
    expect(screen.queryByLabelText(/Tap a thump/)).toBeNull();
  });

  it('lays a beat down as the finger lands, not as it lifts', async () => {
    const onTap = jest.fn();
    await show({ onTap });

    await fireEvent(screen.getByLabelText('Tap the beat'), 'pressIn');

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('lays nothing down while nothing is playing', async () => {
    // The bug this fixes: a tap against a stopped take landed wherever the
    // playhead happened to be left.
    const onTap = jest.fn();
    await show({ onTap, isArmed: false });

    await fireEvent(screen.getByLabelText('Tap the beat'), 'pressIn');

    expect(onTap).not.toHaveBeenCalled();
  });

  it('says why it is not ready', async () => {
    await show({ isArmed: false });
    expect(screen.queryByText(/Play the take/)).not.toBeNull();
  });

  it('says how many marks there are, and claims nothing else', async () => {
    // No tempo is read from these and no bars: a mark on a recording must not
    // redraw the thing it was made on (INV-NOTES-161).
    await show({ count: 8 });
    expect(screen.queryByText('8 tapped')).not.toBeNull();
    expect(screen.queryByText(/BPM/)).toBeNull();
  });

  it('offers to start over only once there is something to throw away', async () => {
    const bare = await show({ count: 0, onClear: jest.fn() });
    expect(bare.queryByLabelText('Throw away the tapped beats')).toBeNull();
    await bare.unmount();

    const some = await show({ count: 5, onClear: jest.fn() });
    expect(
      some.queryByLabelText('Throw away the tapped beats')
    ).not.toBeNull();
  });
});
