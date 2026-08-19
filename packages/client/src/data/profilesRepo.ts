/**
 * profilesRepo — cloud CRUD for the signed-in user's profile + account deletion.
 *
 * The profile row (`public.profiles`) is created automatically on sign-up by the
 * `handle_new_user` trigger, so this module never inserts; it reads, updates the
 * display name, and (for account closure) deletes the whole account.
 *
 * It maps the snake_case Postgres row to the camelCase {@link ProfileDto} from
 * `shared` — the only place that mapping happens for profiles — and is the sole
 * data seam the Profile screen talks to.
 *
 * See supabase/migrations/0001_init.sql (profiles table + delete_account RPC).
 */
import { AppErrorCode, appError } from 'shared';
import type { ProfileDto } from 'shared';

import { backend, COLLECTIONS } from '../lib/backend';
import type { UserRecord } from '../lib/backend';
import { requireUserId } from './currentUser';

/**
 * The profile IS the auth record. PocketBase's users collection carries the
 * display name, so there is no separate profiles collection to keep in step —
 * one account has exactly one profile by construction.
 */
type ProfileRow = UserRecord;

/** Map a record to the camelCase {@link ProfileDto} wire shape. */
function rowToDto(row: ProfileRow): ProfileDto {
  return {
    id: row.id,
    // An empty name reads as "unset" so the UI falls back to the email.
    displayName: row.name.length > 0 ? row.name : null,
    createdAtMs: Date.parse(row.created)
  };
}

export const profilesRepo = {
  /** The current user's profile. */
  async get(): Promise<ProfileDto> {
    const userId = await requireUserId();
    try {
      const record = await backend
        .collection(COLLECTIONS.users)
        .getOne<ProfileRow>(userId);
      return rowToDto(record);
    } catch (error) {
      throw appError(AppErrorCode.Network, 'Failed to load profile', error);
    }
  },

  /**
   * Update the display name. An empty/whitespace-only value clears it (stored as
   * null) so the UI can fall back to the email. Returns the updated profile.
   */
  async updateDisplayName(displayName: string): Promise<ProfileDto> {
    const userId = await requireUserId();
    const trimmed = displayName.trim();
    try {
      const record = await backend
        .collection(COLLECTIONS.users)
        .update<ProfileRow>(userId, { name: trimmed });
      return rowToDto(record);
    } catch (error) {
      throw appError(AppErrorCode.Network, 'Failed to update profile', error);
    }
  },

  /**
   * Permanently delete the account, then clear the local session so the app
   * returns to the auth stack.
   *
   * Deleting the auth record is the whole operation: the collection's delete
   * rule is `id = @request.auth.id`, so a caller can only ever delete
   * themselves, and the cascadeDelete relations remove their notes and
   * progress — attached audio files included. The previous backend needed a
   * SECURITY DEFINER routine plus a hand-rolled blob sweep because its
   * foreign-key cascade could not reach object storage.
   */
  async deleteAccount(): Promise<void> {
    const userId = await requireUserId();
    try {
      await backend.collection(COLLECTIONS.users).delete(userId);
    } catch (error) {
      throw appError(AppErrorCode.Network, 'Failed to delete account', error);
    }
    backend.authStore.clear();
  }
};

export type ProfilesRepo = typeof profilesRepo;

export default profilesRepo;
