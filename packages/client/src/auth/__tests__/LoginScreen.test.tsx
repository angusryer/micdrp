/**
 * LoginScreen tests — drive the real screen through the real AuthProvider (with
 * a mocked Supabase client) and the real ThemeProvider, so the wiring between
 * the form, the auth context, and the SDK is exercised end to end.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react-native';
import React from 'react';

import { AuthProvider } from '../AuthContext';
import { ThemeProvider } from '../../theme';
import LoginScreen from '../../screens/Login/LoginScreen';

// --- Mock the single backend client ---------------------------------------
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
  failNextAuth,
  resetFakeBackend
} from '../../testing/fakeBackend';

beforeEach(() => {
  resetFakeBackend();
});

async function renderScreen() {
  return await render(
    <ThemeProvider>
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('renders the sign-in form by default', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByLabelText('Sign in')).toBeTruthy();
  });

  it('signs in with the entered credentials, trimmed', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), '  a@b.c ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Sign in'));
    });

    // The email is trimmed before it reaches the backend.
    await waitFor(() =>
      expect(fakeBackend.authStore.record?.email).toBe('a@b.c')
    );
  });

  it('toggles to sign-up mode and creates an account', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByLabelText('Switch to create an account'));
    expect(screen.getByLabelText('Sign up')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'new@user.io');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'pw123456');
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Sign up'));
    });

    // Sign-up creates the record, then authenticates it so the app lands
    // signed in rather than back at the form.
    await waitFor(() =>
      expect(fakeBackend.authStore.record?.email).toBe('new@user.io')
    );
  });

  it('shows an error message when sign in fails', async () => {
    failNextAuth('Invalid login credentials');
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.c');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Sign in'));
    });

    await waitFor(() =>
      expect(screen.getByText('Invalid login credentials')).toBeTruthy()
    );
  });

  it('does not submit when fields are empty', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Sign in'));
    expect(fakeBackend.authStore.isValid).toBe(false);
  });
});
