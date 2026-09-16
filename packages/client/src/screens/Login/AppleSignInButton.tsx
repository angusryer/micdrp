/**
 * The Sign in with Apple button (INV-ACCOUNT-027).
 *
 * Renders nothing on a binary without the native module, so a bundle that
 * reaches an older build over the air shows the email form alone. Cancelling
 * the sheet is not a failure and reports nothing.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { useAuth } from '../../auth';
import { appleSignInAvailable } from '../../auth/appleSignIn';
import { errorMessage } from '../../utilities/errorMessage';

interface Props {
  isDisabled: boolean;
  onError(message: string | null): void;
}

export default function AppleSignInButton({
  isDisabled,
  onError
}: Props): React.JSX.Element | null {
  const { signInWithApple } = useAuth();
  const [busy, setBusy] = useState(false);
  const [available] = useState(appleSignInAvailable);

  const onPress = useCallback(async () => {
    setBusy(true);
    onError(null);
    try {
      await signInWithApple();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [onError, signInWithApple]);

  if (!available) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => void onPress()}
        disabled={isDisabled || busy}
        accessibilityRole='button'
        accessibilityLabel='Sign in with Apple'>
        {busy ? (
          <ActivityIndicator color='#fff' />
        ) : (
          <Text style={styles.label}>{''} Sign in with Apple</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: { color: '#fff', fontSize: 17, fontWeight: '600' }
});
