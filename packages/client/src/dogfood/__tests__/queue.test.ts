/**
 * Reading back what the loop says about itself — INV-DOG-024.
 *
 * Most of this is about missing or malformed fields: a clip recorded before
 * progress existed must still appear in the list, because a queue that hides
 * older work answers the question wrongly.
 */
const mockGetFullList = jest.fn();
const mockDelete = jest.fn();
const mockUpdate = jest.fn();
jest.mock('../../lib/backend', () => ({
  backend: {
    collection: () => ({
      getFullList: mockGetFullList,
      delete: mockDelete,
      update: mockUpdate
    })
  }
}));

import { discardClip, feedbackQueue } from '../queue';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  recorded_at_ms: 1000,
  duration_ms: 4000,
  state: 'claimed',
  transcript: 'make the record button smaller',
  progress_percent: 30,
  progress_note: 'building 1 of 2',
  progress_at_ms: 5000,
  ...over
});

beforeEach(() => {
  mockGetFullList.mockReset();
  mockDelete.mockReset();
  mockUpdate.mockReset();
});

describe('feedbackQueue', () => {
  it('reads progress the loop has reported', async () => {
    mockGetFullList.mockResolvedValue([row()]);
    const [clip] = await feedbackQueue(6000);
    expect(clip.progress).toEqual({ percent: 30, note: 'building 1 of 2', atMs: 5000 });
  });

  it('prefers the name the loop gave the remark', async () => {
    // A list of titles reads as a list of things; a list of transcripts reads
    // as a wall of speech.
    mockGetFullList.mockResolvedValue([row({ title: 'Record button styling' })]);
    expect((await feedbackQueue())[0].label).toBe('Record button styling');
  });

  it('falls back to what was said, before the loop has read it', async () => {
    mockGetFullList.mockResolvedValue([row()]);
    expect((await feedbackQueue())[0].label).toBe('make the record button smaller');
  });

  it('ignores a blank title rather than showing an empty row', async () => {
    mockGetFullList.mockResolvedValue([row({ title: '   ' })]);
    expect((await feedbackQueue())[0].label).toBe('make the record button smaller');
  });

  it('shortens a long remark rather than filling the screen', async () => {
    mockGetFullList.mockResolvedValue([row({ transcript: 'x'.repeat(200) })]);
    const label = (await feedbackQueue())[0].label ?? '';
    expect(label.length).toBeLessThan(80);
    expect(label.endsWith('…')).toBe(true);
  });

  it('has no name before there is a transcript', async () => {
    mockGetFullList.mockResolvedValue([row({ transcript: null })]);
    expect((await feedbackQueue())[0].label).toBeNull();
  });

  it('INV-DOG-028: a clip nobody has picked up has no progress, not zero', async () => {
    // A number column with nothing in it reads as 0 rather than as absent, so
    // an untouched clip looked like one that reported 0% at the epoch — and
    // therefore as having been silent for fifty-six years.
    mockGetFullList.mockResolvedValue([
      row({ progress_percent: 0, progress_note: '', progress_at_ms: 0, state: 'uploaded' })
    ]);
    const [clip] = await feedbackQueue(Date.now());
    expect(clip.progress).toBeNull();
    expect(clip.isStalled).toBe(false);
  });

  it('keeps a genuine zero once something has actually been reported', async () => {
    mockGetFullList.mockResolvedValue([
      row({ progress_percent: 0, progress_at_ms: 5000 })
    ]);
    expect((await feedbackQueue(6000))[0].progress?.percent).toBe(0);
  });

  it('shows a clip recorded before progress existed, rather than hiding it', async () => {
    mockGetFullList.mockResolvedValue([
      row({ progress_percent: undefined, progress_note: undefined, progress_at_ms: undefined })
    ]);
    const [clip] = await feedbackQueue();
    expect(clip.progress).toBeNull();
    expect(clip.state).toBe('claimed');
  });

  it('marks a clip that reported, then went quiet for too long', async () => {
    // A real report, long ago — as distinct from never having reported at
    // all, which is what progress_at_ms of 0 now means.
    mockGetFullList.mockResolvedValue([row({ progress_at_ms: 1000 })]);
    expect((await feedbackQueue(60 * 60 * 1000))[0].isStalled).toBe(true);
  });

  it('never marks a finished clip as stuck', async () => {
    mockGetFullList.mockResolvedValue([row({ progress_percent: 100, progress_at_ms: 1000 })]);
    expect((await feedbackQueue(60 * 60 * 1000))[0].isStalled).toBe(false);
  });

  it('survives a row whose fields are the wrong type', async () => {
    mockGetFullList.mockResolvedValue([
      row({ progress_percent: 'lots', duration_ms: null, state: 42 })
    ]);
    const [clip] = await feedbackQueue();
    expect(clip.progress).toBeNull();
    expect(clip.durationMs).toBe(0);
    expect(clip.state).toBe('unknown');
  });
});

describe('discardClip', () => {
  it('removes a clip nobody is working on, taking its audio with it', async () => {
    mockDelete.mockResolvedValue(undefined);
    await discardClip({ id: 'c1', state: 'uploaded' });
    expect(mockDelete).toHaveBeenCalledWith('c1');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each(['claimed', 'interpreted'])(
    'tells the run holding a %s clip rather than pulling it away',
    async (state) => {
      // Taking something away mid-task and leaving the agent to work out what
      // happened is the wrong shape: a missing record could as easily be a
      // fault as a decision, and those want opposite responses.
      mockUpdate.mockResolvedValue(undefined);
      await discardClip({ id: 'c1', state });
      expect(mockUpdate).toHaveBeenCalledWith('c1', { state: 'cancelled' });
      expect(mockDelete).not.toHaveBeenCalled();
    }
  );

  it('removes a delivered clip outright, since no run holds it', async () => {
    mockDelete.mockResolvedValue(undefined);
    await discardClip({ id: 'c1', state: 'delivered' });
    expect(mockDelete).toHaveBeenCalledWith('c1');
  });

  it('lets a failure surface, so the screen can say it did not work', async () => {
    // Swallowing this would leave a row on screen that the person believes
    // is gone, which is worse than telling them.
    mockDelete.mockRejectedValue(new Error('offline'));
    await expect(discardClip({ id: 'c1', state: 'uploaded' })).rejects.toThrow('offline');
  });
});
