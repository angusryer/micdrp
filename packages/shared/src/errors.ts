/**
 * Cross-cutting error contract shared by the client and any future edge
 * functions. The lowest layer in the monorepo — depends on nothing.
 */
export enum AppErrorCode {
  Unknown = 'UNKNOWN',
  Unauthorized = 'UNAUTHORIZED',
  NotFound = 'NOT_FOUND',
  Validation = 'VALIDATION',
  Network = 'NETWORK',
  Storage = 'STORAGE',
  Auth = 'AUTH'
}

/**
 * A real Error, so `instanceof Error` holds, a stack is captured, and test
 * assertions and crash reporters treat it as an error rather than as a plain
 * object that happens to have a `message`.
 */
export interface AppError extends Error {
  code: AppErrorCode;
  cause?: unknown;
}

export function appError(
  code: AppErrorCode,
  message: string,
  cause?: unknown
): AppError {
  const error = new Error(message) as AppError;
  error.name = 'AppError';
  error.code = code;
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}
