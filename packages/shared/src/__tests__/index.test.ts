import { appError, AppErrorCode, STORAGE_BUCKET, TABLES } from '../index';

describe('shared contract', () => {
  it('builds a typed AppError', () => {
    const e = appError(AppErrorCode.NotFound, 'missing');
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toBe('missing');
  });

  it('exposes backend constants', () => {
    expect(STORAGE_BUCKET).toBe('notes');
    expect(TABLES.notes).toBe('notes');
    expect(TABLES.practiceProgress).toBe('practice_progress');
  });
});
