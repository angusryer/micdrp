/**
 * TransportBar — the record / stop control.
 *
 * This is the one place React state legitimately drives the UI: the button
 * reflects the COARSE machine state (idle / recording / analyzing), which only
 * changes a handful of times per session. The per-frame pitch path is handled
 * elsewhere (PitchLine / NoteRibbon via shared values) and never re-renders
 * this component.
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { useTheme } from '../../theme';
import type { RecordingStateValue } from '../../state/recordingMachine';

export interface TransportBarProps {
  state: RecordingStateValue;
  onStart(): void;
  onStop(): void;
}

export function TransportBar({
  state,
  onStart,
  onStop
}: TransportBarProps): React.JSX.Element {
  const { colors } = useTheme();

  const isRecording = state === 'recording';
  const isBusy = state === 'analyzing' || state === 'requestingPermission';

  const onPress = isRecording ? onStop : onStart;

  const buttonStyle = useMemo(
    () => [
      styles.button,
      {
        backgroundColor: isRecording ? colors.error : colors.primary500,
        opacity: isBusy ? 0.6 : 1
      }
    ],
    [isRecording, isBusy, colors.error, colors.primary500]
  );

  const label = isRecording ? 'Stop' : 'Record';
  const accessibilityLabel = isRecording ? 'Stop recording' : 'Start recording';

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBusy, busy: isBusy }}
        accessibilityLabel={accessibilityLabel}
        testID="transport-button"
        disabled={isBusy}
        onPress={onPress}
        style={buttonStyle}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.neutral50} />
        ) : (
          <View
            style={[
              styles.glyph,
              isRecording ? styles.stopGlyph : styles.recordGlyph,
              { backgroundColor: colors.neutral50 }
            ]}
          />
        )}
      </Pressable>
      <Text style={[styles.label, { color: colors.typography }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center'
  },
  glyph: {},
  recordGlyph: { width: 28, height: 28, borderRadius: 14 },
  stopGlyph: { width: 26, height: 26, borderRadius: 4 },
  label: { marginTop: 8, fontSize: 14, fontWeight: '600' }
});

export default TransportBar;
