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
import { useTranslation } from '../../i18n';
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
  const { t } = useTranslation();

  const isRecording = state === 'recording';
  const isBusy = state === 'analyzing' || state === 'requestingPermission';

  const onPress = isRecording ? onStop : onStart;

  // Red in both states: this is a record control, not an accent. `error` is the
  // palette's only red and already carried the recording state.
  const buttonStyle = useMemo(
    () => [
      styles.button,
      { backgroundColor: colors.error, opacity: isBusy ? 0.6 : 1 }
    ],
    [isBusy, colors.error]
  );

  const label = isRecording ? t('record.stop') : t('record.record');
  const accessibilityLabel = isRecording
    ? t('record.stopRecording')
    : t('record.startRecording');

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
        {/*
          Idle carries no inner glyph on purpose: a light dot inside the disc
          reads as a hole against the cream canvas, which made the button look
          like a stroked ring rather than a filled circle. The label below
          already names the state, and recording still shows a stop square.
        */}
        {isBusy ? (
          <ActivityIndicator color={colors.neutral50} />
        ) : isRecording ? (
          <View
            testID="transport-stop-glyph"
            style={[styles.stopGlyph, { backgroundColor: colors.neutral50 }]}
          />
        ) : null}
      </Pressable>
      <Text style={[styles.label, { color: colors.typography }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stopGlyph: { width: 20, height: 20, borderRadius: 4 },
  label: { marginTop: 8, fontSize: 14, fontWeight: '600' }
});

export default TransportBar;
