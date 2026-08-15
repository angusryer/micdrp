/**
 * Keychain-backed storage for the Supabase auth session.
 *
 * supabase-js persists its session through a simple async key/value store. The
 * default on React Native would be AsyncStorage, which is plain unencrypted
 * files in the app container: a refresh token sitting there survives backups
 * and is readable on a compromised device. The Keychain is the platform's own
 * secret store, so that is where the session goes.
 *
 * RECONSTRUCTED. The original was written but never committed — a bare `lib/`
 * line in .gitignore matched at any depth and silently excluded this whole
 * directory from every commit, so it exists in no branch and no backup. This
 * is rebuilt from its call sites, from the jest mocks that pin its contract,
 * and from the description in docs/HANDOFF.md. Behaviour should match; the
 * exact original wording of comments and any incidental helpers will not.
 *
 * Every method swallows its errors and degrades to "no stored session". A
 * Keychain read can fail for reasons that are not the user's problem — a
 * locked device during a background refresh, a simulator with no entitlement —
 * and the correct response to all of them is to ask the user to sign in again,
 * never to crash the app on launch.
 */
import * as Keychain from 'react-native-keychain';

/**
 * One Keychain entry holds the whole session blob, keyed by service name.
 * supabase-js asks for a handful of keys; giving each its own Keychain service
 * keeps them independent and lets a single key be cleared on sign-out.
 */
const SERVICE_PREFIX = 'micdrp.auth.';

/** The username field is unused; Keychain requires one, so it is fixed. */
const ACCOUNT = 'supabase';

function serviceFor(key: string): string {
  return SERVICE_PREFIX + key;
}

export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * The storage adapter handed to `createClient`.
 *
 * Shaped exactly as supabase-js expects: three async methods, string in and
 * string or null out.
 */
export const secureSessionStorage: SessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const entry = await Keychain.getGenericPassword({
        service: serviceFor(key)
      });
      return entry ? entry.password : null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(ACCOUNT, value, {
        service: serviceFor(key),
        // The session must be readable when the app refreshes a token in the
        // background, which rules out the unlocked-only accessibility levels.
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
      });
    } catch {
      // A session that cannot be persisted still works for this run; the user
      // is simply asked to sign in again next launch.
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: serviceFor(key) });
    } catch {
      // Nothing to do — the entry is either gone or unreachable, and both mean
      // the caller's intent (no stored session) is satisfied.
    }
  }
};

export default secureSessionStorage;
