/**
 * useProfile — the Profile screen's controller.
 *
 * Loads the signed-in user's profile from `profilesRepo`, holds the editable
 * display name, and exposes the three account actions (save name, sign out,
 * delete account). Sign-out / delete both clear the Supabase session, so the
 * navigator reactively swaps back to the auth stack — there is no manual
 * navigation here.
 *
 * This hook is the single seam between the Profile UI and the data layer; the
 * screen stays presentational.
 */
import { useCallback, useEffect, useState } from 'react';

import type { ProfileDto } from 'shared';

import { useAuth } from '../../auth';
import { profilesRepo } from '../../data/profilesRepo';
import { errorMessage } from '../../utilities/errorMessage';

export interface UseProfileValue {
  /** The signed-in user's email (from the auth session), or null. */
  email: string | null;
  /** The loaded profile, or null until the first load resolves. */
  profile: ProfileDto | null;
  /** True while the initial profile load is in flight. */
  loading: boolean;
  /** Last error message (load/save/delete), or null. */
  error: string | null;

  /** The editable display-name field value. */
  displayName: string;
  setDisplayName(value: string): void;
  /** True when the edited name differs from the saved profile. */
  dirty: boolean;
  /** True while a save is in flight. */
  saving: boolean;
  /** Persist the edited display name. */
  save(): Promise<void>;

  /** True while account deletion is in flight. */
  deleting: boolean;
  /** Permanently delete the account (and sign out). */
  deleteAccount(): Promise<void>;

  /** Sign out of the current session. */
  signOut(): Promise<void>;
}

/** The saved display name as a plain string ('' when unset). */
function nameOf(profile: ProfileDto | null): string {
  return profile?.displayName ?? '';
}

export function useProfile(): UseProfileValue {
  const { user, signOut: authSignOut } = useAuth();

  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load. The effect owns a `cancelled` flag so a unmount mid-flight
  // never sets state on a dead component.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    profilesRepo
      .get()
      .then((p) => {
        if (cancelled) {
          return;
        }
        setProfile(p);
        setDisplayName(nameOf(p));
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = displayName.trim() !== nameOf(profile).trim();

  const save = useCallback(async (): Promise<void> => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await profilesRepo.updateDisplayName(displayName);
      setProfile(updated);
      setDisplayName(nameOf(updated));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [saving, displayName]);

  const deleteAccount = useCallback(async (): Promise<void> => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await profilesRepo.deleteAccount();
      // On success the session is cleared and the navigator swaps stacks.
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(false);
    }
  }, [deleting]);

  const signOut = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await authSignOut();
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [authSignOut]);

  return {
    email: user?.email ?? null,
    profile,
    loading,
    error,
    displayName,
    setDisplayName,
    dirty,
    saving,
    save,
    deleting,
    deleteAccount,
    signOut
  };
}

export default useProfile;
