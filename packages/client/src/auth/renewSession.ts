/**
 * Keeping the session alive with rotating refresh tokens
 * (INV-ACCOUNT-017..023).
 *
 * Every renewal goes through one in-flight promise. Two renewals racing with
 * one refresh token would present it twice, which the backend reads as theft
 * and answers by ending the line (INV-ACCOUNT-018, 021).
 */
import { SESSION_ROUTES, type SessionMetaDto } from 'shared';

import { backend, type UserRecord } from '../lib/backend';
import {
  currentRefreshToken,
  loadRefreshToken,
  storeRefreshToken
} from './refreshToken';
import { expiresWithin } from './tokenExpiry';

export type RenewOutcome = 'renewed' | 'refused' | 'unreachable' | 'none';

interface AuthResponse {
  token: string;
  record: UserRecord;
  meta?: SessionMetaDto;
}

let inFlight: Promise<RenewOutcome> | null = null;
let adoptionTried = false;

const statusOf = (error: unknown): number | undefined =>
  (error as { status?: number } | null)?.status;

/** Exchange the refresh token for a new pair. Concurrent calls share one. */
export function renewSession(): Promise<RenewOutcome> {
  inFlight ??= exchange().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function exchange(): Promise<RenewOutcome> {
  await loadRefreshToken();
  const presented = currentRefreshToken();
  if (!presented) {
    return 'none';
  }
  try {
    const auth = await backend.send<AuthResponse>(SESSION_ROUTES.refresh, {
      method: 'POST',
      body: { refreshToken: presented }
    });
    // Signed out, or signed in afresh, while this was on the wire.
    if (currentRefreshToken() !== presented) {
      return 'none';
    }
    await storeRefreshToken(auth.meta?.refreshToken ?? null);
    backend.authStore.save(auth.token, auth.record as never);
    return 'renewed';
  } catch (error) {
    // Only a refusal ends a session; anything else is unreachable
    // (INV-ACCOUNT-020).
    if (statusOf(error) !== 401 || currentRefreshToken() !== presented) {
      return 'unreachable';
    }
    await storeRefreshToken(null);
    backend.authStore.clear();
    return 'refused';
  }
}

/** Give a session from before rotation its first refresh token (INV-ACCOUNT-023). */
async function adopt(): Promise<void> {
  if (adoptionTried || !backend.authStore.isValid) {
    return;
  }
  adoptionTried = true;
  try {
    const { refreshToken } = await backend.send<SessionMetaDto>(
      SESSION_ROUTES.adopt,
      { method: 'POST' }
    );
    if (refreshToken && !currentRefreshToken()) {
      await storeRefreshToken(refreshToken);
    }
  } catch {
    // An older backend, or an account that already has a line: the access
    // token still works until it expires, as it did before.
  }
}

/** Renew when the access token expires within `seconds`. */
export async function renewIfStale(seconds: number): Promise<void> {
  const { token, record } = backend.authStore;
  if (!token || !record) {
    return;
  }
  await loadRefreshToken();
  if (!currentRefreshToken()) {
    await adopt();
  } else if (expiresWithin(token, seconds)) {
    await renewSession();
  }
}

/** End the line on the backend, best effort; local state clears at once. */
export function endLine(): void {
  const refreshToken = currentRefreshToken();
  void storeRefreshToken(null);
  if (refreshToken) {
    backend
      .send(SESSION_ROUTES.signOut, { method: 'POST', body: { refreshToken } })
      .catch(() => undefined);
  }
}

/** Whether a request to `url` is itself part of keeping the session. */
export function isSessionRoute(url: string): boolean {
  return Object.values(SESSION_ROUTES).some((route) => url.endsWith(route));
}

/** Reset module state, as a relaunch would. Tests only. */
export function relaunchRenewalForTests(): void {
  inFlight = null;
  adoptionTried = false;
}
