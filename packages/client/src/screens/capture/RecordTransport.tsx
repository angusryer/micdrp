/**
 * RecordTransport — start, and stop, on the recording view.
 *
 * The one place React state legitimately drives this UI: the control reflects
 * the coarse machine state, which changes a handful of times a session. The
 * per-frame pitch path is shared values and never re-renders this.
 *
 * Its own control rather than `TransportBar`, which is the compact disc that
 * lived above the note list. Here the button is the thing at the bottom of a
 * dark screen that a thumb finds without looking, so it is large and it says
 * what it does in words as well as in shape.
 *
 * Pause is deliberately absent. A capture that can be paused has to be able to
 * resume writing the same file on the native side, and until it can, a control
 * offering to pause would either stop the take or lie about it — the worse of
 * the two being the one that looks like it worked.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { RecordingStateValue } from '../../state/recordingMachine';

export interface RecordTransportProps {
  state: RecordingStateValue;
  onStart(): void;
  /** Stop, save, and leave. The take is the thing; there is nothing after it. */
  onStop(): void;
  /** True once the note has been written, so the control can say so. */
  isSaved?: boolean;
}

export function RecordTransport({
  state,
  onStart,
  onStop,
  isSaved = false
}: RecordTransportProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const isRecording = state === 'recording';
  const isBusy = state === 'analyzing' || state === 'requestingPermission';

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBusy, busy: isBusy }}
        accessibilityLabel={
          isRecording ? t('record.stopRecording') : t('record.startRecording')
        }
        testID="record-button"
        disabled={isBusy}
        onPress={isRecording ? onStop : onStart}
        style={[
          styles.button,
          { backgroundColor: colors.error, opacity: isBusy ? 0.6 : 1 }
        ]}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.neutral50} />
        ) : isRecording ? (
          // A square inside the disc: the shape everything that records uses
          // for stop, so it needs no reading.
          <View
            testID="record-stop-glyph"
            style={[styles.stopGlyph, { backgroundColor: colors.neutral50 }]}
          />
        ) : null}
      </Pressable>
      <Text style={[styles.label, { color: colors.neutral50 }]}>
        {isSaved
          ? t('record.saved')
          : isRecording
            ? t('record.stop')
            : t('record.record')}
      </Text>
    </View>
  );
}

export default RecordTransport;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8 },
  // Large: this is found by a thumb on a dark screen, without looking.
  button: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stopGlyph: { width: 26, height: 26, borderRadius: 5 },
  label: { marginTop: 8, fontSize: 14, fontWeight: '600' }
});
