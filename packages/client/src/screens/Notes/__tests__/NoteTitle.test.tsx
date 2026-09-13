/**
 * INV-NOTES-272 — a take is renamed in place, from the take itself.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';

import { NoteTitle } from '../NoteTitle';

const show = (onRename: jest.Mock, title = 'A tune') =>
  render(
    <GestureHandlerRootView>
      <NoteTitle title={title} onRename={onRename} />
    </GestureHandlerRootView>
  );

const twoTaps = () =>
  fireGestureHandler(getByGestureTestId('note-title-tap'), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { state: State.END }
  ]);

describe('a take’s name', () => {
  it('is read, not edited, until it is tapped twice', async () => {
    await show(jest.fn());
    expect(screen.getByTestId('note-title')).toBeTruthy();
    expect(screen.queryByTestId('note-title-input')).toBeNull();
  });

  it('turns into something to type in on two taps', async () => {
    await show(jest.fn());
    await act(async () => twoTaps());
    expect(screen.getByTestId('note-title-input').props.value).toBe('A tune');
  });

  it('keeps what was typed when it is left', async () => {
    const onRename = jest.fn();
    await show(onRename);
    await act(async () => twoTaps());
    await act(async () => {
      await fireEvent.changeText(screen.getByTestId('note-title-input'), 'Chorus idea');
      await fireEvent(screen.getByTestId('note-title-input'), 'blur', {
        nativeEvent: { text: 'Chorus idea' }
      });
    });
    expect(onRename).toHaveBeenCalledWith('Chorus idea');
    expect(screen.getByTestId('note-title')).toBeTruthy();
  });

  it('refuses an empty name and keeps the one it had', async () => {
    const onRename = jest.fn();
    await show(onRename);
    await act(async () => twoTaps());
    await act(async () => {
      await fireEvent.changeText(screen.getByTestId('note-title-input'), '   ');
      await fireEvent(screen.getByTestId('note-title-input'), 'blur', {
        nativeEvent: { text: '   ' }
      });
    });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('A tune')).toBeTruthy();
  });

  it('says nothing when the name was not actually changed', async () => {
    const onRename = jest.fn();
    await show(onRename);
    await act(async () => twoTaps());
    await act(async () => {
      await fireEvent(screen.getByTestId('note-title-input'), 'blur', {
        nativeEvent: { text: 'A tune' }
      });
    });
    expect(onRename).not.toHaveBeenCalled();
  });
});
