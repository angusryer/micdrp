/**
 * RecordScreen — singing, with nothing else on the screen (VIEW-NOTES-010).
 *
 * The recorder used to sit above the note list, which made it a strip of a
 * browsing page: no room to draw what was being heard, and nowhere to put the
 * things a singer does with their hands. It is its own view now, and the list
 * is just the list.
 *
 * Dark, because a phone held at arm's length in a room should be legible
 * without being the brightest thing in it. Awake, because a screen that dims
 * mid-take stopped showing what it was asked to show at the one moment nobody
 * has a free hand (INV-NOTES-138).
 *
 * The beat is tapped in here rather than only on playback (INV-NOTES-137).
 * The moment a person is surest where the pulse is, is while they are singing
 * to it; asking them to sing it, open it, play it and tap along is asking for
 * the performance twice, and the second one is the one being measured.
 *
 * Composition only. What a capture is lives in useNoteCapture; every
 * per-frame value arrives as a shared value and never crosses React state.
 */
import React, { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { PitchLine } from './PitchLine';
import { NoteName } from './NoteName';
import { RecordTransport } from './RecordTransport';
import { useScreenAwake } from './useScreenAwake';
import { BeatTap } from '../Notes/BeatTap';
import { useNoteCapture } from '../Notes/useNoteCapture';
import { PITCH_LINE_HEIGHT, pitchLineWidth } from '../Notes/captureLayout';

/** How tall the trace is here — most of the room, since it is the picture. */
const TRACE_HEIGHT = PITCH_LINE_HEIGHT * 2;

export function RecordScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const [saved, setSaved] = useState(false);

  const {
    sharedMidi,
    sharedFrame,
    state,
    isRecording,
    start,
    stopAndSave,
    tapBeat,
    tappedCount,
    saveStatus
  } = useNoteCapture(() => setSaved(true));

  // Held for as long as this view is open, whatever route it is left by.
  useScreenAwake();

  // Back to the list once the note is written. The take is the thing; there
  // is nothing to look at here afterwards.
  const finish = useCallback(() => {
    void stopAndSave().then(() => navigation.goBack());
  }, [stopAndSave, navigation]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.stage }]}>
      {/* Where a glance lands without the eye leaving the line being drawn. */}
      <View style={styles.corner}>
        <NoteName
          testID="heard-note"
          sharedMidi={sharedMidi}
          style={[styles.noteName, { color: colors.neutral50 }]}
        />
      </View>

      <View style={styles.trace}>
        <PitchLine
          sharedMidi={sharedMidi}
          sharedFrame={sharedFrame}
          width={pitchLineWidth(width)}
          height={TRACE_HEIGHT}
        />
      </View>

      <View style={styles.spacer} />

      {saveStatus === 'error' ? (
        <Text style={[styles.error, { color: colors.error }]}>
          {t('notes.saveError')}
        </Text>
      ) : null}

      {/* The two things a singer does with their hands, in reach of a thumb:
          tap the pulse, and stop. */}
      <View style={styles.hands}>
        <BeatTap
          onTap={tapBeat}
          isArmed={isRecording}
          count={tappedCount}
          bpm={null}
        />
        <RecordTransport
          state={state}
          onStart={start}
          onStop={finish}
          isSaved={saved}
        />
      </View>
    </SafeAreaView>
  );
}

export default RecordScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 16 },
  corner: { alignItems: 'flex-end', paddingTop: 8 },
  noteName: { fontSize: 40, fontWeight: '700', minWidth: 96 },
  trace: { marginTop: 12, height: TRACE_HEIGHT, borderRadius: 16, overflow: 'hidden' },
  // Everything else is pushed to the bottom: the top half is what is being
  // heard, the bottom half is what can be done about it.
  spacer: { flex: 1 },
  hands: { paddingBottom: 12, gap: 4 },
  error: { textAlign: 'center', fontSize: 13, paddingBottom: 8 }
});
