import { appError, AppErrorCode } from '../index';

describe('shared contract', () => {
  it('builds a typed AppError', () => {
    const e = appError(AppErrorCode.NotFound, 'missing');
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toBe('missing');
  });

});
