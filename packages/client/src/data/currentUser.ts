/**
 * currentUser — the authenticated user's id, or a typed Unauthorized error.
 *
 * Shared by every data-layer module that scopes a query to the signed-in user
 * (recordings, profile, …) so the "are we authenticated?" check lives in exactly
 * one place and always throws the same `shared` {@link AppError} shape.
 */
import { AppErrorCode, appError } from 'shared';

import { hasSession } from '../auth/sessionState';
import { backend } from '../lib/backend';

/** The current authenticated user's id, or throw an Unauthorized AppError. */
export async function requireUserId(): Promise<string> {
  const { record } = backend.authStore;
  if (!hasSession() || !record) {
    throw appError(AppErrorCode.Unauthorized, 'No authenticated user');
  }
  return Promise.resolve(record.id);
}
