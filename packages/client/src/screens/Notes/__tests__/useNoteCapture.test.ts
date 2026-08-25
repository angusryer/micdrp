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

const mockKeepLocally = jest.fn();
const mockPutNote = jest.fn();
jest.mock('../../../data/notesLocal', () => ({
  keepLocally: (...args: unknown[]) => mockKeepLocally(...args),
  putNote: (...args: unknown[]) => mockPutNote(...args),
  localNoteId: () => 'local-1'
}));

const mockFlush = jest.fn();
jest.mock('../../../data/notesQueue', () => ({
  flushPending: () => mockFlush()
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
  mockKeepLocally.mockReturnValue({ id: 'local-1', interpretations: [] });
  mockFlush.mockResolvedValue(0);
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
  it('writes the beats onto the note it belongs to', async () => {
    const { result } = await renderHook(() => useNoteCapture());
    mockController.elapsedMs.mockReturnValue(750);
    await act(async () => {
      result.current.tapBeat();
    });
    await act(async () => {
      await result.current.stopAndSave('A tune');
    });

    await waitFor(() => expect(mockPutNote).toHaveBeenCalled());
    const [written] = mockPutNote.mock.calls[0] as [
      { interpretations: { beats?: { atMs: number }[] }[] }
    ];
    expect(written.interpretations[0].beats?.[0].atMs).toBe(750);
  });

  it('writes no reading at all when nothing was tapped', async () => {
    // A note nobody tapped has no decision recorded about it, and an empty
    // reading is not the same as no reading.
    const { result } = await renderHook(() => useNoteCapture());
    await act(async () => {
      await result.current.stopAndSave();
    });

    expect(mockKeepLocally).toHaveBeenCalled();
    expect(mockPutNote).not.toHaveBeenCalled();
  });
});

describe('keeping a take before sending it (INV-NOTES-139)', () => {
  it('keeps it on the device, then tries to send it', async () => {
    // What was sung is a fact the moment it was sung; where it ends up
    // stored is a detail that can be retried.
    const { result } = await renderHook(() => useNoteCapture());
    await act(async () => {
      await result.current.stopAndSave('A tune');
    });

    expect(mockKeepLocally).toHaveBeenCalled();
    const [, audioUri] = mockKeepLocally.mock.calls[0] as [unknown, string];
    expect(audioUri).toBe('file:///take.wav');
    await waitFor(() => expect(mockFlush).toHaveBeenCalled());
  });

  it('reports the take as kept even when it cannot be sent', async () => {
    // The upload is allowed to fail. The note is already on the device, and
    // the device is where the singer will look for it.
    mockFlush.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useNoteCapture());
    await act(async () => {
      await result.current.stopAndSave('A tune');
    });

    expect(result.current.saveStatus).toBe('saved');
  });
});
