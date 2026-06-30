/**
 * RecordScreen — the live record screen and the app's performance-critical hot
 * path. It composes the pieces; it owns no DSP and almost no React state.
 *
 *   useRecordController  → binds the engine + recordingMachine to shared values
 *   PitchLine            → Skia trace driven by those shared values (UI thread)
 *   NoteRibbon           → current note + cents meter (UI thread)
 *   TransportBar         → record/stop, reflecting the coarse machine state
 *
 * On stop, the captured `RecordingHandle` is handed to the Results route, where
 * the offline `logic` pipeline (smoothPitch → segmentNotes → notesToMidi /
 * scorePitch) runs over `handle.samples`.
 *
 * The per-audio-frame path NEVER crosses React state — see useRecordController.
 */

import React, { useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../../theme';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { useRecordController } from './useRecordController';
import { PitchLine } from './PitchLine';
import { NoteRibbon } from './NoteRibbon';
import { TransportBar } from './TransportBar';

/** Composed navigation props: tab screen nested inside the root stack. */
export type RecordScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Record'>,
  NativeStackScreenProps<RootStackParamList>
>;

type RecordNavigation = RecordScreenProps['navigation'];

const PITCH_LINE_HEIGHT = 220;
const PITCH_LINE_MARGIN = 16;

export function RecordScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<RecordNavigation>();

  const {
    start,
    stop,
    sharedMidi,
    sharedCents,
    sharedFrame,
    state,
    isRecording
  } = useRecordController();

  const handleStart = useCallback((): void => {
    // A denied permission rejects; the machine has already moved to `error`
    // (TransportBar reflects it), so swallow the rejection here.
    start().catch(() => undefined);
  }, [start]);

  const handleStop = useCallback((): void => {
    stop()
      .then((handle) => navigation.navigate('Results', { handle }))
      .catch(() => undefined);
  }, [stop, navigation]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.neutral300 }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {isRecording ? 'Listening…' : 'Sing'}
        </Text>
      </View>

      <NoteRibbon sharedMidi={sharedMidi} sharedCents={sharedCents} />

      <View
        style={[
          styles.pitchWrap,
          { backgroundColor: colors.neutral50, borderColor: colors.neutral500 }
        ]}
      >
        <PitchLine
          sharedMidi={sharedMidi}
          sharedFrame={sharedFrame}
          width={width - 2 * PITCH_LINE_MARGIN}
          height={PITCH_LINE_HEIGHT}
        />
      </View>

      <View style={styles.transport}>
        <TransportBar
          state={state}
          onStart={handleStart}
          onStop={handleStop}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  pitchWrap: {
    marginHorizontal: PITCH_LINE_MARGIN,
    height: PITCH_LINE_HEIGHT,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  transport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default RecordScreen;
