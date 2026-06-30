/**
 * Export / share controls for a finished take (WP-RESULTS-UI).
 *
 * Shares the already-written `.mid` blob via `react-native-share`. The file is
 * written once by `useResults` (the single fs seam); this component only triggers
 * the OS share sheet over the resulting `file://` URI. It owns transient share
 * status only — never any pipeline or per-frame state.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Share from 'react-native-share';

import { useTheme } from '../../theme';

export interface ExportSheetProps {
  /** `file://` URI of the exported `.mid`, or null until it has been written. */
  midiUri: string | null;
  /** Title used as the share subject / filename hint. */
  title: string;
}

type ShareStatus = 'idle' | 'sharing' | 'error';

export function ExportSheet({ midiUri, title }: ExportSheetProps) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<ShareStatus>('idle');

  const onShare = useCallback(async () => {
    if (midiUri == null || status === 'sharing') {
      return;
    }
    setStatus('sharing');
    try {
      await Share.open({
        title,
        subject: title,
        failOnCancel: false,
        type: 'audio/midi',
        filename: `${title}.mid`,
        url: midiUri
      });
      setStatus('idle');
    } catch {
      // User-cancel and real failures both land here; surface a soft error.
      setStatus('error');
    }
  }, [midiUri, status, title]);

  const disabled = midiUri == null || status === 'sharing';

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel="Export MIDI"
        disabled={disabled}
        onPress={onShare}
        style={[
          styles.button,
          {
            backgroundColor: disabled ? colors.neutral500 : colors.primary500
          }
        ]}
      >
        {status === 'sharing' ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.white }]}>Export MIDI</Text>
        )}
      </Pressable>

      {midiUri == null ? (
        <Text style={[styles.hint, { color: colors.gray300 }]}>Preparing MIDI…</Text>
      ) : null}
      {status === 'error' ? (
        <Text style={[styles.hint, { color: colors.error }]}>
          Couldn’t share the file. Try again.
        </Text>
      ) : null}
    </View>
  );
}

export default ExportSheet;

const styles = StyleSheet.create({
  container: { gap: 8 },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, textAlign: 'center' }
});
