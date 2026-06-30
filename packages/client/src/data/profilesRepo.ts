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
import { STORAGE_BUCKET, TABLES, AppErrorCode, appError } from 'shared';
import type { ProfileDto } from 'shared';

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';
import { requireUserId } from './currentUser';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

/** Map a Postgres row to the camelCase {@link ProfileDto} wire shape. */
function rowToDto(row: ProfileRow): ProfileDto {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAtMs: Date.parse(row.created_at)
  };
}

export const profilesRepo = {
  /** The current user's profile. */
  async get(): Promise<ProfileDto> {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from(TABLES.profiles)
      .select()
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw appError(
        AppErrorCode.Network,
        'Failed to load profile',
        error ?? undefined
      );
    }
    return rowToDto(data);
  },

  /**
   * Update the display name. An empty/whitespace-only value clears it (stored as
   * null) so the UI can fall back to the email. Returns the updated profile.
   */
  async updateDisplayName(displayName: string): Promise<ProfileDto> {
    const userId = await requireUserId();
    const trimmed = displayName.trim();
    const { data, error } = await supabase
      .from(TABLES.profiles)
      .update({ display_name: trimmed.length > 0 ? trimmed : null })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw appError(
        AppErrorCode.Network,
        'Failed to update profile',
        error ?? undefined
      );
    }
    return rowToDto(data);
  },

  /**
   * Permanently delete the account. Storage blobs are removed first (the FK
   * cascade covers the DB rows but not Storage objects), then the `delete_account`
   * RPC hard-deletes the auth user (cascading profiles + recordings), and finally
   * the local session is cleared so the app returns to the auth stack.
   */
  async deleteAccount(): Promise<void> {
    const userId = await requireUserId();

    // Best-effort blob cleanup: list the user's folder and remove every object.
    const { data: files } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(userId);
    if (files && files.length > 0) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(files.map((f) => `${userId}/${f.name}`));
    }

    const { error } = await supabase.rpc('delete_account');
    if (error) {
      throw appError(AppErrorCode.Network, 'Failed to delete account', error);
    }

    await supabase.auth.signOut();
  }
};

export type ProfilesRepo = typeof profilesRepo;

export default profilesRepo;
