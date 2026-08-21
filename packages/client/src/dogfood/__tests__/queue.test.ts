/**
 * Reading back what the loop says about itself — INV-DOG-024.
 *
 * Most of this is about missing or malformed fields: a clip recorded before
 * progress existed must still appear in the list, because a queue that hides
 * older work answers the question wrongly.
 */
const mockGetFullList = jest.fn();
jest.mock('../../lib/backend', () => ({
  backend: { collection: () => ({ getFullList: mockGetFullList }) }
}));

import { feedbackQueue } from '../queue';

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

beforeEach(() => mockGetFullList.mockReset());

describe('feedbackQueue', () => {
  it('reads progress the loop has reported', async () => {
    mockGetFullList.mockResolvedValue([row()]);
    const [clip] = await feedbackQueue(6000);
    expect(clip.progress).toEqual({ percent: 30, note: 'building 1 of 2', atMs: 5000 });
  });

  it('names a clip by what was said in it', async () => {
    mockGetFullList.mockResolvedValue([row()]);
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

  it('shows a clip recorded before progress existed, rather than hiding it', async () => {
    mockGetFullList.mockResolvedValue([
      row({ progress_percent: undefined, progress_note: undefined, progress_at_ms: undefined })
    ]);
    const [clip] = await feedbackQueue();
    expect(clip.progress).toBeNull();
    expect(clip.state).toBe('claimed');
  });

  it('marks a clip that has been silent too long', async () => {
    mockGetFullList.mockResolvedValue([row({ progress_at_ms: 0 })]);
    expect((await feedbackQueue(60 * 60 * 1000))[0].isStalled).toBe(true);
  });

  it('never marks a finished clip as stuck', async () => {
    mockGetFullList.mockResolvedValue([row({ progress_percent: 100, progress_at_ms: 0 })]);
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
