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
 * It starts recording on arrival. The press that opened it was already the
 * decision to sing — asking for a second press is asking twice for one
 * intention, and the take that matters is the one somebody had in their head
 * when they reached for the button.
 *
 * Which is why leaving has to be free. There is a way out at the top left
 * that throws the take away, because a view that starts recording the moment
 * it opens must never be a view you are stuck in.
 *
 * Stopping opens the note it just kept rather than returning to the list.
 * Somebody who has sung an idea is far more likely to want to work on it —
 * sing a bass line against it, put the beat right — than to want to look at
 * a list, and the list is one press away from there anyway.
 *
 * Composition only. What a capture is lives in useNoteCapture; every
 * per-frame value arrives as a shared value and never crosses React state.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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

  // Straight into it. The press that opened this view was the decision to
  // sing; asking for a second one asks twice for a single intention.
  useEffect(() => {
    start();
    // Once, on arrival. Re-running it would restart a capture underneath
    // itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Into the note once it is kept. There is nothing to look at here
  // afterwards, and the thing somebody usually wants next is the take they
  // have just sung.
  const finish = useCallback(() => {
    void stopAndSave().then((id) => {
      navigation.goBack();
      if (id != null) {
        navigation.navigate('NoteDetail', { id });
      }
    });
  }, [stopAndSave, navigation]);

  // Out, without keeping anything. Nothing is saved and nothing is asked:
  // somebody who wants this take gone has already decided, and a dialog would
  // be the app arguing with them.
  const abandon = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.stage }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('record.discard')}
          testID="discard-take"
          onPress={abandon}
          hitSlop={12}
          style={({ pressed }) => [styles.leave, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.leaveText, { color: colors.neutral50 }]}>
            {t('record.discard')}
          </Text>
        </Pressable>

        {/* Where a glance lands without the eye leaving the line being
            drawn. On its own disc in a light colour: dark text on a dark
            ground is a readout nobody can read. */}
        <View style={[styles.notePill, { backgroundColor: colors.neutral50 }]}>
          <NoteName
            testID="heard-note"
            sharedMidi={sharedMidi}
            style={[styles.noteName, { color: colors.typography }]}
          />
        </View>
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8
  },
  leave: { paddingVertical: 8, paddingRight: 12 },
  leaveText: { fontSize: 16, fontWeight: '600' },
  // A disc rather than bare text: the readout changes constantly, and a shape
  // that stays put is what makes a changing thing readable at a glance.
  notePill: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center'
  },
  noteName: { fontSize: 30, fontWeight: '700', minWidth: 76 },
  trace: { marginTop: 12, height: TRACE_HEIGHT, borderRadius: 16, overflow: 'hidden' },
  // Everything else is pushed to the bottom: the top half is what is being
  // heard, the bottom half is what can be done about it.
  spacer: { flex: 1 },
  hands: { paddingBottom: 12, gap: 4 },
  error: { textAlign: 'center', fontSize: 13, paddingBottom: 8 }
});
