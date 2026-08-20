/**
 * CaptureSection — the recorder that sits above the note list on VIEW-NOTES-001.
 *
 * Split out of NotesScreen so the screen stays readable and so the preview's
 * height lives next to the frame that draws it. Every per-frame value arrives
 * as a Reanimated shared value and is consumed on the UI thread; nothing here
 * re-renders while a capture runs except the coarse transport state.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { PitchLine } from '../capture/PitchLine';
import { NoteRibbon } from '../capture/NoteRibbon';
import { TransportBar } from '../capture/TransportBar';
import type { RecordingStateValue } from '../../state/recordingMachine';
import type { SaveStatus } from './useNoteCapture';
import {
  PITCH_LINE_HEIGHT,
  PITCH_LINE_MARGIN,
  pitchLineWidth
} from './captureLayout';

export interface CaptureSectionProps {
  sharedMidi: SharedValue<number>;
  sharedCents: SharedValue<number>;
  sharedFrame: SharedValue<number>;
  state: RecordingStateValue;
  isRecording: boolean;
  saveStatus: SaveStatus;
  onStart(): void;
  onStop(): void;
}

export function CaptureSection({
  sharedMidi,
  sharedCents,
  sharedFrame,
  state,
  isRecording,
  saveStatus,
  onStart,
  onStop
}: CaptureSectionProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.capture}>
      <View style={styles.captureHeader}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {isRecording ? t('notes.recording') : t('notes.capture')}
        </Text>
        {saveStatus === 'saving' ? (
          <ActivityIndicator size="small" color={colors.primary500} />
        ) : null}
      </View>

      <NoteRibbon sharedMidi={sharedMidi} sharedCents={sharedCents} />

      <View
        testID="pitch-preview"
        style={[
          styles.pitchWrap,
          { backgroundColor: colors.neutral50, borderColor: colors.neutral500 }
        ]}
      >
        <PitchLine
          sharedMidi={sharedMidi}
          sharedFrame={sharedFrame}
          width={pitchLineWidth(width)}
          height={PITCH_LINE_HEIGHT}
        />
      </View>

      <TransportBar state={state} onStart={onStart} onStop={onStop} />

      {saveStatus === 'error' ? (
        <Text style={[styles.error, { color: colors.error }]}>
          {t('notes.saveError')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  capture: { paddingTop: 12, paddingBottom: 8, gap: 8 },
  captureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  title: { fontSize: 18, fontWeight: '700' },
  pitchWrap: {
    marginHorizontal: PITCH_LINE_MARGIN,
    height: PITCH_LINE_HEIGHT,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  error: { textAlign: 'center', fontSize: 13 }
});

export default CaptureSection;
