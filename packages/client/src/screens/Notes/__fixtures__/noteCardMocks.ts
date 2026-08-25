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
/**
 * What state the next AudioContext will report, and where its clock stands.
 *
 * Faithful on purpose. The double used to have neither, so a take booked
 * against the context clock fell straight to the "start now" path in every
 * test while the device took the other one — and a booking made against a
 * suspended clock never arrives, which is silence no test could see
 * (INV-NOTES-127).
 */
export const audioContext = {
  state: 'running',
  currentTime: 12.5,
  /** True where the session will not let the context start — a live capture. */
  willNotResume: false
};
export const mockResume = jest.fn().mockImplementation(() => {
  if (audioContext.willNotResume) {
    // What a session held by a live capture actually does: it refuses.
    return Promise.reject(new Error('session is busy'));
  }
  audioContext.state = 'running';
  return Promise.resolve();
});

export const audioApiMock = () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    destination: {},
    decodeAudioData: mockDecode,
    // The take runs through a level now, so the double has to offer one.
    createGain: () => ({ gain: { value: 1 }, connect: jest.fn() }),
    createBufferSource: () => ({
      buffer: null,
      connect: jest.fn(),
      start: mockStart,
      stop: jest.fn(),
      onended: null
    }),
    get state() {
      return audioContext.state;
    },
    get currentTime() {
      return audioContext.currentTime;
    },
    resume: mockResume,
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
  audioContext.state = 'running';
  audioContext.currentTime = 12.5;
  audioContext.willNotResume = false;
  mockDecode.mockResolvedValue({ duration: 12 });
  mockAudioUrlFor.mockResolvedValue(REMOTE);
};
