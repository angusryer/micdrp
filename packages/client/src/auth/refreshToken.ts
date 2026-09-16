/**
 * The refresh token, held in the Keychain beside the access token
 * (INV-ACCOUNT-001) and mirrored in memory so the session can be read
 * synchronously.
 *
 * Reads go through secureSession, which never throws: a Keychain that cannot
 * be read is "no refresh token", and the singer signs in again
 * (INV-ACCOUNT-002).
 */
import { secureSessionStorage } from '../lib/secureSession';

const KEY = 'pb_refresh';

let cached: string | null = null;
let written = false;
let loading: Promise<void> | null = null;

/** Read the stored token once per launch. Safe to await repeatedly. */
export function loadRefreshToken(): Promise<void> {
  loading ??= secureSessionStorage.getItem(KEY).then((stored) => {
    // A sign-in that finished before the read came back is the newer truth.
    if (!written) {
      cached = stored;
    }
  });
  return loading;
}

/** The refresh token in hand, or null. Only meaningful after loading. */
export function currentRefreshToken(): string | null {
  return cached;
}

/**
 * Replace the stored token, or clear it with null. The in-memory copy changes
 * before the Keychain write starts, so a caller that clears it and then clears
 * the session never shows a session in between.
 */
export async function storeRefreshToken(token: string | null): Promise<void> {
  written = true;
  cached = token;
  await (token
    ? secureSessionStorage.setItem(KEY, token)
    : secureSessionStorage.removeItem(KEY));
}

/** Forget the in-memory copy, as a relaunch would. Tests only. */
export function relaunchRefreshTokenForTests(): void {
  cached = null;
  written = false;
  loading = null;
}
