/**
 * INV-NOTES-137 — tapping the beat while the take is being sung, and keeping
 * what was tapped.
 *
 * The taps land on the capture's own timeline — the one the melody is written
 * on — and are written with the note as its beats, so opening it shows them
 * where they were put.
 *
 * `renderHook` is async in this setup — await it.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockController = {
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
  sharedPitch: { value: 0 },
  sharedClarity: { value: 0 },
  sharedMidi: { value: -1 },
  sharedCents: { value: 0 },
  sharedFrame: { value: 0 },
  state: 'idle' as string,
  isRecording: false,
  elapsedMs: jest.fn()
};

jest.mock('../../capture/useRecordController', () => ({
  useRecordController: () => mockController,
  UNVOICED_MIDI: -1
}));

const mockCreate = jest.fn();
const mockSaveInterpretations = jest.fn();
jest.mock('../../../data/notesRepo', () => ({
  notesRepo: {
    create: (...args: unknown[]) => mockCreate(...args),
    saveInterpretations: (...args: unknown[]) => mockSaveInterpretations(...args)
  }
}));

jest.mock('../../../analysis/note', () => ({
  analyzeCapture: () => ({ noteInput: { durationMs: 1000, melody: [] } })
}));

import { useNoteCapture } from '../useNoteCapture';

beforeEach(() => {
  jest.clearAllMocks();
  mockController.isRecording = true;
  mockController.start.mockResolvedValue(undefined);
  mockController.stop.mockResolvedValue({ uri: 'file:///take.wav' });
  mockController.elapsedMs.mockReturnValue(0);
  mockCreate.mockResolvedValue({ id: 'note-1' });
  mockSaveInterpretations.mockResolvedValue(undefined);
});

describe('tapping the beat while singing', () => {
  it('stamps each tap against the capture’s own clock', async () => {
    const { result } = await renderHook(() => useNoteCapture());

    for (const atMs of [500, 1000, 1500]) {
      mockController.elapsedMs.mockReturnValue(atMs);
      await act(async () => {
        result.current.tapBeat();
      });
    }

    expect(result.current.tappedCount).toBe(3);
  });

  it('lays nothing down when no capture is running', async () => {
    // A tap against a stopped capture has no moment to be at, so it would
    // land wherever the last one did — a beat placed by accident.
    mockController.isRecording = false;
    const { result } = await renderHook(() => useNoteCapture());

    await act(async () => {
      result.current.tapBeat();
    });

    expect(result.current.tappedCount).toBe(0);
  });

  it('reads a bouncing finger as one beat', async () => {
    const { result } = await renderHook(() => useNoteCapture());
    for (const atMs of [500, 520]) {
      mockController.elapsedMs.mockReturnValue(atMs);
      await act(async () => {
        result.current.tapBeat();
      });
    }
    expect(result.current.tappedCount).toBe(1);
  });

  it('starts a fresh count when a new capture begins', async () => {
    const { result } = await renderHook(() => useNoteCapture());
    mockController.elapsedMs.mockReturnValue(500);
    await act(async () => {
      result.current.tapBeat();
    });
    await act(async () => {
      result.current.start();
    });
    expect(result.current.tappedCount).toBe(0);
  });
});

describe('keeping what was tapped', () => {
  it('writes the beats with the note it belongs to', async () => {
    const { result } = await renderHook(() => useNoteCapture());
    mockController.elapsedMs.mockReturnValue(750);
    await act(async () => {
      result.current.tapBeat();
    });
    await act(async () => {
      await result.current.stopAndSave('A tune');
    });

    await waitFor(() => expect(mockSaveInterpretations).toHaveBeenCalled());
    const [noteId, readings] = mockSaveInterpretations.mock.calls[0] as [
      string,
      { beats?: { atMs: number }[] }[]
    ];
    // After the note exists, because they belong to it.
    expect(noteId).toBe('note-1');
    expect(readings[0].beats?.[0].atMs).toBe(750);
  });

  it('writes no reading at all when nothing was tapped', async () => {
    // A note nobody tapped has no decision recorded about it, and an empty
    // reading is not the same as no reading.
    const { result } = await renderHook(() => useNoteCapture());
    await act(async () => {
      await result.current.stopAndSave();
    });

    expect(mockCreate).toHaveBeenCalled();
    expect(mockSaveInterpretations).not.toHaveBeenCalled();
  });
});
