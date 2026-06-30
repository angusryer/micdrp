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

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
}

export function appError(
  code: AppErrorCode,
  message: string,
  cause?: unknown
): AppError {
  return { code, message, cause };
}
