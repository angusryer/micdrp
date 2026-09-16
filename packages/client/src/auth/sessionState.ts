/**
 * Whether the stored session is a session (INV-NOTES-140, INV-ACCOUNT-020).
 *
 * A token and a record are not enough: an expired token with nothing to renew
 * it is signed out. An expired token with a refresh token is signed in —
 * renewal decides the rest, and only the backend refusing it signs anyone
 * out, so a singer with no signal still reaches their notes.
 */
import { backend } from '../lib/backend';
import { currentRefreshToken } from './refreshToken';

export function hasSession(): boolean {
  const { token, record, isValid } = backend.authStore;
  return Boolean(token && record && (isValid || currentRefreshToken()));
}
