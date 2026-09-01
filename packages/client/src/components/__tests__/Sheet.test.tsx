/**
 * INV-NOTES-181, INV-NOTES-109 — one sheet, and it always says what it covers.
 *
 * There were four, each written out again, and they had drifted: one reported
 * what it covered and three did not. The scroll-clear fault was found and
 * fixed once, then shipped again with the next sheet.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../../theme';
import { Sheet } from '../Sheet';

/** Where the mock says the sheet settled, which decides what it covers. */
const settleAt = (y: number): void => {
  (globalThis as unknown as { TRUE_SHEET_POSITION: number }).TRUE_SHEET_POSITION =
    y;
};

const props = () =>
  (
    globalThis as unknown as {
      TRUE_SHEET_PROPS: Record<
        string,
        {
          detents: (number | string)[];
          dimmed?: boolean;
          scrollable?: boolean;
          scrollableOptions?: { scrollingExpandsSheet?: boolean };
        }
      >;
    }
  ).TRUE_SHEET_PROPS.probe;

const open = (over: Partial<React.ComponentProps<typeof Sheet>> = {}) =>
  waitFor(() =>
    render(
      <ThemeProvider>
        <Sheet name="probe" isOpen onClose={jest.fn()} {...over}>
          <Text>inside</Text>
        </Sheet>
      </ThemeProvider>
    )
  );

describe('every sheet', () => {
  it('says how much of the screen it covers when it settles', async () => {
    const onCover = jest.fn();
    settleAt(500);
    await open({ onCover });
    expect(onCover).toHaveBeenCalledWith('probe', expect.any(Number));
    expect(onCover.mock.calls[0][0]).toBe('probe');
    expect(onCover.mock.calls[0][1]).toBeGreaterThan(0);
  });

  it('never reports a negative cover', async () => {
    const onCover = jest.fn();
    // Settled above the top of the screen, which should read as covering all
    // of it rather than as a negative.
    settleAt(99999);
    await open({ onCover });
    expect(onCover.mock.calls[0][1]).toBe(0);
  });

  it('gives the room back when it goes', async () => {
    const onCover = jest.fn();
    const onClose = jest.fn();
    settleAt(500);
    const { rerender } = await open({ onCover, onClose });
    await waitFor(() =>
      rerender(
        <ThemeProvider>
          <Sheet
            name="probe"
            isOpen={false}
            onClose={onClose}
            onCover={onCover}
          >
            <Text>inside</Text>
          </Sheet>
        </ThemeProvider>
      )
    );
    expect(onCover).toHaveBeenLastCalledWith('probe', 0);
    expect(onClose).toHaveBeenCalled();
  });

  it('fits its content unless told otherwise', async () => {
    await open();
    expect(props().detents).toEqual(['auto']);
  });

  it('takes the heights it is given', async () => {
    await open({ detents: [0.4, 0.9] });
    expect(props().detents).toEqual([0.4, 0.9]);
  });

  it('dims by default, and not when told not to', async () => {
    await open();
    expect(props().dimmed).toBe(true);
    await open({ isDimmed: false });
    expect(props().dimmed).toBe(false);
  });

  it('pins its own scroll, or its content cannot be reached', async () => {
    // Off unless asked for, so the content ran past the bottom of the sheet
    // and nothing scrolled at all (INV-NOTES-194).
    await open();
    expect(props().scrollable).toBe(true);
  });

  it('is not expanded by scrolling its contents', async () => {
    // A sheet held part way so the graph stays visible must not close over it
    // the moment its own content is scrolled.
    await open();
    expect(props().scrollableOptions?.scrollingExpandsSheet).toBe(false);
  });

  it('does not pin a scroll where the caller supplies one', async () => {
    await open({ isScrolling: false });
    expect(props().scrollable).toBe(false);
  });

  it('shows what it was given', async () => {
    await open();
    expect(screen.getAllByText('inside').length).toBeGreaterThan(0);
  });
});
