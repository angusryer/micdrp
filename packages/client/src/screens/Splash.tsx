/**
 * Splash — the branded launch / session-restore screen.
 *
 * Shown by the RootNavigator while the auth session is being restored (which was
 * previously a blank frame). The mark is a Skia vector glyph, so the splash is
 * resolution-independent and ships over-the-air with the JS bundle — no native
 * launch-image asset to rebuild.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

export default function Splash(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.center}>
        <Icon name="mic" size={72} color={colors.primary500} />
        <Text style={[styles.wordmark, { color: colors.typography }]}>micdrp</Text>
        <ActivityIndicator color={colors.primary500} style={styles.spinner} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  wordmark: { fontSize: 32, fontWeight: '700', letterSpacing: 1 },
  spinner: { marginTop: 16 }
});
