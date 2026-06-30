/**
 * LoginScreen — real email/password auth over `useAuth` (Supabase).
 *
 * One screen, two modes (sign in / sign up) toggled in place. Submits through
 * the auth context; on success the navigator swaps to the main stack reactively
 * (it gates on `session`), so there is no manual navigation here. Errors from the
 * shared `AppError` shape are surfaced inline; the submit button shows a spinner
 * while the request is in flight.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { useAuth } from '../../auth';
import { useTheme } from '../../theme';
import { errorMessage } from '../../utilities/errorMessage';

type Mode = 'signIn' | 'signUp';

export default function LoginScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'signUp';
  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trimmedEmail = email.trim();
      if (isSignUp) {
        await signUp(trimmedEmail, password);
      } else {
        await signIn(trimmedEmail, password);
      }
      // On success the auth listener updates the session and the navigator
      // reactively swaps stacks — nothing to do here.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, email, password, isSignUp, signIn, signUp]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setError(null);
  }, []);

  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        backgroundColor: colors.neutral100,
        borderColor: colors.neutral500,
        color: colors.typography
      }
    ],
    [colors]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.typography }]}>
            micdrp
          </Text>
          <Text style={[styles.subtitle, { color: colors.gray300 }]}>
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </Text>

          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.gray300}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!submitting}
            accessibilityLabel="Email"
          />

          <TextInput
            style={inputStyle}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.gray300}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="password"
            editable={!submitting}
            accessibilityLabel="Password"
          />

          {error ? (
            <Text
              style={[styles.error, { color: colors.error }]}
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: colors.primary500,
                opacity: canSubmit ? 1 : 0.5
              }
            ]}
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={isSignUp ? 'Sign up' : 'Sign in'}
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.white }]}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggle}
            onPress={toggleMode}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={
              isSignUp
                ? 'Switch to sign in'
                : 'Switch to create an account'
            }
          >
            <Text style={[styles.toggleText, { color: colors.primary500 }]}>
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 14
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center'
  },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  toggle: {
    marginTop: 20,
    alignItems: 'center'
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600'
  }
});
