/**
 * INV-NOTES-197 — what a person did to a take is not lost by a bad
 * connection.
 *
 * A take has two things that cannot be produced again: the recording, and
 * what a person did to it. The recording had a queue; this did not, and
 * sixteen tapped beats went missing because of it.
 */
import {
  flushInterpretations,
  pendingInterpretations,
  queueInterpretations,
  renameQueued,
  resetInterpretationQueueForTests
} from '../interpretationQueue';

const mockSave = jest.fn();
jest.mock('../notesRepo', () => ({
  notesRepo: { saveInterpretations: (...args: unknown[]) => mockSave(...args) }
}));

const reading = (name: string) =>
  [{ id: name, name, createdAtMs: 1, chords: [], beats: [{ atMs: 500 }] }] as never;

beforeEach(() => {
  resetInterpretationQueueForTests();
  mockSave.mockReset().mockResolvedValue(undefined);
});

describe('keeping what a person decided', () => {
  it('ACC-NOTES-046: survives a failed save and a relaunch', async () => {
    mockSave.mockRejectedValue(new Error('offline'));
    queueInterpretations('note-1', reading('a'));
    expect(await flushInterpretations()).toBe(0);
    // The queue is persisted, so a fresh read is what a relaunch sees.
    expect(pendingInterpretations().map((p) => p.noteId)).toEqual(['note-1']);
  });

  it('ACC-NOTES-047: reaches the server once it can', async () => {
    mockSave.mockRejectedValue(new Error('offline'));
    queueInterpretations('note-1', reading('a'));
    await flushInterpretations();
    mockSave.mockResolvedValue(undefined);
    expect(await flushInterpretations()).toBe(1);
    expect(pendingInterpretations()).toHaveLength(0);
  });

  it('keeps one entry per take, the newest', async () => {
    // An interpretation is the whole of what a person has decided about a
    // take, so the newest replaces the one waiting rather than queueing
    // behind it.
    mockSave.mockRejectedValue(new Error('offline'));
    queueInterpretations('note-1', reading('a'));
    queueInterpretations('note-1', reading('b'));
    await flushInterpretations();
    expect(pendingInterpretations()).toHaveLength(1);
    expect(mockSave.mock.calls.at(-1)?.[1][0].id).toBe('b');
  });

  it('ACC-NOTES-048: follows a note the server renamed', async () => {
    // A note takes a new id when it uploads. Beats tapped before then were
    // saved against an id the server has never heard of.
    mockSave.mockRejectedValue(new Error('offline'));
    queueInterpretations('local-1', reading('a'));
    renameQueued('local-1', 'server-1');
    mockSave.mockResolvedValue(undefined);
    await flushInterpretations();
    expect(mockSave).toHaveBeenCalledWith('server-1', expect.anything());
  });

  it('does not drop a change made while the save was in flight', async () => {
    let release: () => void = () => undefined;
    mockSave.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    queueInterpretations('note-1', reading('a'));
    const flushing = flushInterpretations();
    queueInterpretations('note-1', reading('b'));
    release();
    await flushing;
    // 'b' arrived after 'a' was sent and before it was answered. Clearing
    // the queue on the strength of 'a' would lose it silently.
    expect(pendingInterpretations()).toHaveLength(1);
  });

  it('stops at the first failure rather than hammering', async () => {
    mockSave
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('offline'));
    queueInterpretations('note-1', reading('a'));
    queueInterpretations('note-2', reading('b'));
    queueInterpretations('note-3', reading('c'));
    expect(await flushInterpretations()).toBe(1);
    expect(pendingInterpretations()).toHaveLength(2);
  });
});
