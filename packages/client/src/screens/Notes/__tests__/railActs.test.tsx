/**
 * ACC-NOTES-245, ACC-NOTES-246 / INV-NOTES-230, INV-NOTES-231 — the foot
 * pulls out into the acts that remake the graph.
 *
 * Three things that change what is drawn rather than what is heard, and they
 * were three controls in three places, all of them below the graph or behind
 * a sheet. The foot is where the take is already handled.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { RailFoot } from '../RailFoot';
import type { RailActsProps } from '../RailActs';

/** As much of a shared value as a clock reads. */
const held = (value: number) => ({ value }) as SharedValue<number>;

const onRecord = jest.fn();
const onReread = jest.fn();
const onChords = jest.fn();

const acts = (over: Partial<RailActsProps> = {}): RailActsProps => ({
  isRecording: false,
  onRecord,
  isRereading: false,
  onReread,
  hasChords: false,
  onChords,
  ...over
});

const setup = async (offered: RailActsProps | null = acts()) =>
  waitFor(() =>
    render(
      <GestureHandlerRootView>
        <I18nProvider>
          <ThemeProvider>
            <RailFoot
              state="stopped"
              positionMs={held(0)}
              durationMs={26_000}
              onPlay={jest.fn()}
              onPause={jest.fn()}
              acts={offered}
            />
          </ThemeProvider>
        </I18nProvider>
      </GestureHandlerRootView>
    )
  );

beforeEach(() => {
  onRecord.mockReset();
  onReread.mockReset();
  onChords.mockReset();
});

it('ACC-NOTES-245: offers each act once, and each the same width', async () => {
  const view = await setup();
  const widths = ['act-record', 'act-reread', 'act-chords'].map((id) => {
    const style = view.getByTestId(id).props.style as { width: number };
    return style.width;
  });
  expect(widths[0]).toBe(widths[1]);
  expect(widths[1]).toBe(widths[2]);
});

it('is the moment that opens it, and the same touch that shuts it', async () => {
  const view = await setup();
  const handle = view.getByTestId('rail-handle');
  expect(handle.props.accessibilityState.expanded).toBe(false);
  await fireEvent.press(handle);
  await waitFor(() =>
    expect(
      view.getByTestId('rail-handle').props.accessibilityState.expanded
    ).toBe(true)
  );
  await fireEvent.press(view.getByTestId('rail-handle'));
  await waitFor(() =>
    expect(
      view.getByTestId('rail-handle').props.accessibilityState.expanded
    ).toBe(false)
  );
});

it('sings a bass line under the tune, and stops', async () => {
  const view = await setup();
  await fireEvent.press(view.getByTestId('act-record'));
  expect(onRecord).toHaveBeenCalled();
});

it('says it is working while the take is read again', async () => {
  const view = await setup(acts({ isRereading: true }));
  // A re-read reads the whole recording; a control that looks idle while it
  // runs invites a second press.
  expect(view.getByTestId('act-reread').props.accessibilityState.busy).toBe(
    true
  );
  await fireEvent.press(view.getByTestId('act-reread'));
  expect(onReread).not.toHaveBeenCalled();
});

it('ACC-NOTES-246: says whether the chords are on the graph', async () => {
  const off = await setup(acts({ hasChords: false }));
  expect(off.getByTestId('act-chords').props.accessibilityState.checked).toBe(
    false
  );
  await fireEvent.press(off.getByTestId('act-chords'));
  expect(onChords).toHaveBeenCalled();

  const on = await setup(acts({ hasChords: true }));
  expect(on.getByTestId('act-chords').props.accessibilityState.checked).toBe(
    true
  );
});

it('does not offer a handle where there is nothing to open', async () => {
  const view = await setup(null);
  // The moment is still read there; what is gone is the promise that
  // touching it does something.
  const handle = view.getByTestId('rail-handle');
  expect(handle.props.accessibilityState.disabled).toBe(true);
  expect(handle.props.accessibilityState.expanded).toBeUndefined();
  expect(view.queryByTestId('act-record')).toBeNull();
  expect(view.getByTestId('rail-clock')).toBeTruthy();
});
