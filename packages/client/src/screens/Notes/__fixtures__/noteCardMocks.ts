/**
 * The module replacements a NoteCard suite needs: a fake AudioContext and a
 * notesRepo whose URL minting is observable.
 *
 * Outside `__tests__` because Jest's default testMatch treats every file under
 * that directory as a suite, and this one has no tests. Imports nothing from
 * the app: a `jest.mock` factory requires it while the module registry is
 * still being wired, and an app import here would be a cycle.
 */

export const mockDecode = jest.fn();
export const mockStart = jest.fn();
export const mockAudioUrlFor = jest.fn();

export const REMOTE =
  'https://micdrp-backend.fly.dev/api/files/notes/abc123/audio.wav?token=t0ken';

/** Replacement for react-native-audio-api. */
export const audioApiMock = () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    destination: {},
    decodeAudioData: mockDecode,
    createBufferSource: () => ({
      buffer: null,
      connect: jest.fn(),
      start: mockStart,
      stop: jest.fn(),
      onended: null
    }),
    close: jest.fn().mockResolvedValue(undefined)
  }))
});

/**
 * Replacement for the notes repo. Called through an arrow rather than passed
 * directly: the mock is installed before this module's consts exist.
 */
export const notesRepoMock = () => ({
  notesRepo: {
    audioUrlFor: (id: string, path: string | null): Promise<string | null> =>
      mockAudioUrlFor(id, path) as Promise<string | null>
  }
});

/** Clear every call and re-arm the happy path: a 12-second take, resolvable. */
export const resetNoteCardMocks = (): void => {
  jest.clearAllMocks();
  mockDecode.mockResolvedValue({ duration: 12 });
  mockAudioUrlFor.mockResolvedValue(REMOTE);
};
