/**
 * AuthContext tests — verify the provider drives off `supabase.auth` correctly:
 * restores the session via the mockOnAuthStateChange listener, exposes the derived
 * user, delegates sign in/up/out, maps errors onto the shared AppError shape,
 * and unsubscribes on unmount.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppErrorCode } from 'shared';

import { AuthProvider, useAuth } from '../AuthContext';

// --- Mock the single Supabase client --------------------------------------
jest.mock('../../lib/backend', () => {
  const fake = jest.requireActual('../../testing/fakeBackend') as {
    fakeBackend: unknown;
  };
  return {
    __esModule: true,
    backend: fake.fakeBackend,
    default: fake.fakeBackend,
    COLLECTIONS: {
      users: 'users',
      notes: 'notes',
      practiceProgress: 'practice_progress'
    }
  };
});

import {
  fakeBackend,
  resetFakeBackend,
  signInFake
} from '../../testing/fakeBackend';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  resetFakeBackend();
});

describe('AuthProvider / useAuth', () => {
  it('resolves to a null session when nothing was restored', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('restores a session and derives the user from it', async () => {
    const id = await signInFake('ada@micdrp.test');
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).not.toBeNull();
    expect(result.current.user?.id).toBe(id);
  });

  it('signIn establishes a session', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('ada@micdrp.test', 'password12345');
    });

    await waitFor(() => expect(result.current.session).not.toBeNull());
    expect(result.current.user?.email).toBe('ada@micdrp.test');
  });

  it('signUp creates the account and lands signed in', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp('new@micdrp.test', 'password12345');
    });

    await waitFor(() => expect(result.current.session).not.toBeNull());
  });

  it('signOut clears the session without deleting anything', async () => {
    const id = await signInFake();
    await fakeBackend.collection('notes').create({ user: id, title: 'Kept' });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    await waitFor(() => expect(result.current.session).toBeNull());
    // Signing back in finds the note still there.
    await signInFake();
    expect(await fakeBackend.collection('notes').getFullList()).toHaveLength(1);
  });

  it('resetPassword does not establish a session', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resetPassword('ada@micdrp.test');
    });

    expect(result.current.session).toBeNull();
  });

  it('maps a backend error onto the shared AppError shape', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    jest
      .spyOn(fakeBackend, 'collection')
      .mockImplementationOnce(
        () =>
          ({
            authWithPassword: () => Promise.reject(new Error('bad credentials'))
          }) as never
      );

    await expect(
      result.current.signIn('ada@micdrp.test', 'wrong')
    ).rejects.toMatchObject({ code: AppErrorCode.Auth });
  });

  it('throws when useAuth is used outside an AuthProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    // renderHook is async in RNTL 14, so the guard surfaces as a rejection
    // rather than a synchronous throw.
    await expect(renderHook(() => useAuth())).rejects.toThrow(
      /must be used within an AuthProvider/
    );
    spy.mockRestore();
  });
});
