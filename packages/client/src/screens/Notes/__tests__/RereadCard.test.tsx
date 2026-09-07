/**
 * INV-NOTES-116 — a take can be read again, and says so before it is.
 *
 * A take has two things that cannot be produced again: the recording, and
 * what a person did to it. Everything else is a reading, so an engine that
 * improved is only useful to the takes already in the library if those
 * readings can be thrown away and made afresh.
 *
 * Always offered, because the reading depends on settings a person can change
 * as well as on the engine's own version. Hiding it on a take this engine had
 * read left no way to apply a changed knob to a recording already made. It
 * says what it costs before the press rather than after.
 */
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { RereadCard } from '../RereadCard';

const show = (
  isStale: boolean,
  onReread = jest.fn().mockResolvedValue(true),
  undo?: { canUndo: boolean; onUndo: jest.Mock }
) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <RereadCard
          isStale={isStale}
          onReread={onReread}
          canUndo={undo?.canUndo}
          onUndo={undo?.onUndo}
        />
      </ThemeProvider>
    </I18nProvider>
  );

describe('reading a take again', () => {
  it('is offered on a take this engine already read', async () => {
    // The settings that decide what a note is can be changed, and a take read
    // with different ones is stale in the way that matters. The version
    // number cannot know that (INV-ACCOUNT-014).
    await show(false);
    expect(screen.queryByTestId('reread-card')).not.toBeNull();
  });

  it('is offered on one read by an older engine too', async () => {
    await show(true);
    expect(screen.queryByTestId('reread-card')).not.toBeNull();
  });

  it('says which of the two reasons applies', async () => {
    const older = await show(true);
    expect(older.queryByText(/older version of the listener/)).not.toBeNull();
    await older.unmount();

    const current = await show(false);
    expect(current.queryByText(/settings as they are now/)).not.toBeNull();
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

/**
 * ACC-NOTES-229 / INV-NOTES-215 — and it can be undone.
 *
 * Every threshold the reader uses is stored once for the app rather than per
 * take, so an old quiet recording gets read with a tuning arrived at against
 * a recent close-sung one. Whether the new reading is better is a judgement
 * only the person who sang it can make, and until now the press was one-way.
 */
describe('putting the previous reading back', () => {
  const undo = (canUndo: boolean) => ({
    canUndo,
    onUndo: jest.fn().mockResolvedValue(undefined)
  });

  it('is not offered on a take that has not been read again', async () => {
    await show(true, jest.fn().mockResolvedValue(true), undo(false));
    expect(screen.queryByTestId('undo-reread')).toBeNull();
  });

  it('ACC-NOTES-229: is offered once a reading has been kept', async () => {
    await show(true, jest.fn().mockResolvedValue(true), undo(true));
    expect(screen.queryByTestId('undo-reread')).not.toBeNull();
  });

  it('says the previous reading is kept, before the press', async () => {
    // Otherwise the warning above it reads as final, and a person who would
    // have tried reading again does not.
    await show(true, jest.fn().mockResolvedValue(true), undo(true));
    expect(screen.queryByText(/you can put it back/)).not.toBeNull();
  });

  it('puts it back when pressed', async () => {
    const back = undo(true);
    await show(true, jest.fn().mockResolvedValue(true), back);

    await act(async () => {
      await fireEvent.press(
        screen.getByLabelText('Put the previous reading back')
      );
    });
    expect(back.onUndo).toHaveBeenCalled();
  });
});
