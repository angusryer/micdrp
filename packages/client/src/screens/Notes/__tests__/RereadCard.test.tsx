/**
 * INV-NOTES-116 — a take can be read again, and says so before it is.
 *
 * A take has two things that cannot be produced again: the recording, and
 * what a person did to it. Everything else is a reading, so an engine that
 * improved is only useful to the takes already in the library if those
 * readings can be thrown away and made afresh.
 *
 * Offered only where it would change something — a control that does nothing
 * invites a person to try it and learn the app cannot tell the difference —
 * and it says what it costs before the press rather than after.
 */
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { RereadCard } from '../RereadCard';

const show = (isStale: boolean, onReread = jest.fn().mockResolvedValue(true)) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <RereadCard isStale={isStale} onReread={onReread} />
      </ThemeProvider>
    </I18nProvider>
  );

describe('reading a take again', () => {
  it('is not offered on a take already read by this engine', async () => {
    await show(false);
    expect(screen.queryByTestId('reread-card')).toBeNull();
  });

  it('is offered on one read by an older engine', async () => {
    await show(true);
    expect(screen.queryByTestId('reread-card')).not.toBeNull();
  });

  it('says what it will replace, before the button rather than after', async () => {
    // What it costs is real: the reading goes, and an edit whose note is no
    // longer there finds nothing to apply to. Worth reading before pressing.
    await show(true);
    expect(screen.queryByText(/will all be replaced/)).not.toBeNull();
    expect(screen.queryByText(/will be lost/)).not.toBeNull();
  });

  it('reads again when pressed', async () => {
    const onReread = jest.fn().mockResolvedValue(true);
    await show(true, onReread);

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Read this take again'));
    });
    expect(onReread).toHaveBeenCalled();
  });

  it('says nothing changed when the recording could not be opened', async () => {
    // Silence here would read as "done", and the take would look re-read
    // when it was not.
    const onReread = jest.fn().mockResolvedValue(false);
    await show(true, onReread);

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Read this take again'));
    });
    expect(screen.queryByText(/could not be opened/)).not.toBeNull();
  });
});
