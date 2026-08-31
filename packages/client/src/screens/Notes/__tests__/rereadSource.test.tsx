/**
 * INV-NOTES-183 — a take is read again from whichever copy of it exists.
 *
 * The guard asked for the uploaded path alone while the function immediately
 * below it preferred the copy on the device. Since capture became local
 * first, a take is local-only until it reaches the server, and every take in
 * that state silently refused to be re-read.
 */
import { act, renderHook } from '@testing-library/react-native';

const mockLocalOnly = {
  id: 'local',
  durationMs: 4000,
  melody: [{ midi: 60, startMs: 0, endMs: 500, cents: 0, clarity: 1 }],
  interpretations: [],
  hits: [],
  layers: [],
  localAudioUri: 'file:///takes/local.m4a',
  audioPath: null
};

const mockUploaded = {
  ...mockLocalOnly,
  id: 'remote',
  localAudioUri: null,
  audioPath: 'notes/remote.m4a'
};

jest.mock('../../../data/notesSync', () => ({
  cachedNotes: () => [mockLocalOnly, mockUploaded],
  cacheReading: jest.fn()
}));

const mockReadFrom = jest.fn();
jest.mock('../../../analysis/reread', () => ({
  rereadTake: (uri: string | null) => {
    mockReadFrom(uri);
    return Promise.resolve(
      uri
        ? { melody: [], hits: [], analysisVersion: 1 }
        : null
    );
  }
}));

jest.mock('../../../data/notesRepo', () => ({
  notesRepo: {
    audioUrlFor: (_id: string, path: string | null) =>
      Promise.resolve(`https://example.com/${path ?? ''}`),
    saveReading: jest.fn(() => Promise.resolve()),
    saveLayers: jest.fn(() => Promise.resolve())
  }
}));

import { useNoteDetail } from '../useNoteDetail';

beforeEach(() => {
  mockReadFrom.mockClear();
});

describe('reading a take again', () => {
  it('reads a take that has only been recorded, never uploaded', async () => {
    const { result } = await renderHook(() => useNoteDetail('local'));
    let read = false;
    await act(async () => {
      read = await result.current.reread();
    });
    expect(mockReadFrom).toHaveBeenCalledWith('file:///takes/local.m4a');
    expect(read).toBe(true);
  });

  it('reads an uploaded take from where it was uploaded', async () => {
    const { result } = await renderHook(() => useNoteDetail('remote'));
    await act(async () => {
      await result.current.reread();
    });
    expect(mockReadFrom).toHaveBeenCalledWith(
      'https://example.com/notes/remote.m4a'
    );
  });
});
