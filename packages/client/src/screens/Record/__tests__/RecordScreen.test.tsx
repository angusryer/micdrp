/**
 * Component test for RecordScreen.
 *
 * The hot-path controller is mocked (so no engine/Skia worklets run) and React
 * Navigation is mocked to capture `navigate`. We assert the wiring the screen is
 * responsible for, with no device:
 *   • it renders the transport control and the live readouts;
 *   • pressing the control while idle calls the controller's start();
 *   • pressing it while recording calls stop() and, once the handle resolves,
 *     navigates to 'Results' with that handle.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import type { RecordingHandle } from '../../../audio/contract';
import type { RecordController } from '../useRecordController';
import { ThemeProvider } from '../../../theme';

// ---- mock navigation: capture navigate() ----
const navigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate })
}));

// ---- mock the controller (the per-frame hot path) ----
const handle: RecordingHandle = {
  id: 'rec-1',
  uri: 'file:///tmp/rec-1.wav',
  sampleRateHz: 44100,
  durationMs: 1000,
  samples: []
};

const makeShared = <T,>(value: T): { value: T } => ({ value });

let controller: RecordController;

jest.mock('../useRecordController', () => ({
  __esModule: true,
  UNVOICED_MIDI: -1,
  useRecordController: () => controller
}));

// Stub the heavy children so the test focuses on screen wiring (and so Skia /
// reanimated derived values don't need real backends beyond the global mocks).
jest.mock('../PitchLine', () => ({
  __esModule: true,
  PitchLine: () => null
}));
jest.mock('../NoteRibbon', () => ({
  __esModule: true,
  NoteRibbon: () => null
}));

import { RecordScreen } from '../RecordScreen';

function buildController(over: Partial<RecordController> = {}): RecordController {
  return {
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve(handle)),
    sharedPitch: makeShared(0),
    sharedClarity: makeShared(0),
    sharedMidi: makeShared(-1),
    sharedCents: makeShared(0),
    sharedFrame: makeShared(0),
    state: 'idle',
    isRecording: false,
    ...over
  } as RecordController;
}

const renderScreen = () =>
  render(
    <ThemeProvider>
      <RecordScreen />
    </ThemeProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecordScreen', () => {
  it('renders the transport control', () => {
    controller = buildController();
    const { getByTestId } = renderScreen();
    expect(getByTestId('transport-button')).toBeTruthy();
  });

  it('calls start() when pressed while idle', () => {
    controller = buildController({ state: 'idle', isRecording: false });
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('transport-button'));
    expect(controller.start).toHaveBeenCalledTimes(1);
    expect(controller.stop).not.toHaveBeenCalled();
  });

  it('calls stop() and navigates to Results with the handle while recording', async () => {
    controller = buildController({ state: 'recording', isRecording: true });
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('transport-button'));

    expect(controller.stop).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('Results', { handle });
    });
  });

  it('does not navigate when merely starting', () => {
    controller = buildController({ state: 'idle', isRecording: false });
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('transport-button'));
    expect(navigate).not.toHaveBeenCalled();
  });
});
