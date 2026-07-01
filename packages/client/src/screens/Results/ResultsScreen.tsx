/**
 * Results screen (WP-RESULTS-UI).
 *
 * Reads the finished {@link RecordingHandle} from the route, runs the offline
 * pipeline + persistence via {@link useResults} (all off the live audio path),
 * and composes the read-only summary: {@link ScoreCard} + {@link NoteList} +
 * {@link ExportSheet}. React state here is coarse only — the per-frame work
 * happened on the native/UI thread during recording.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-RESULTS-UI).
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { findMelody, type TargetNote } from 'logic';

import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { createReferenceTonePlayer } from '../../audio/referenceTone';
import { ExportSheet } from './ExportSheet';
import { FeedbackCard } from './FeedbackCard';
import { NoteList } from './NoteList';
import { ScoreCard } from './ScoreCard';
import { useResults } from './useResults';

/** How long a tapped reference note sounds, in ms. */
const TAP_NOTE_MS = 700;

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export default function ResultsScreen({ route }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { handle, practice } = route.params;

  // For a practice take, rebuild the reference melody so scoring + per-note
  // feedback target it (rather than the take itself).
  const melody = practice ? findMelody(practice.melodyId) : undefined;
  const targets = useMemo<TargetNote[] | undefined>(() => {
    if (!practice || !melody) {
      return undefined;
    }
    return melody.build({
      rootMidi: practice.rootMidi,
      noteDurationMs: practice.noteDurationMs
    });
  }, [practice, melody]);

  const { notes, score, feedback, midiUri } = useResults(handle, {
    targets,
    practice
  });
  const title = melody?.name ?? t('results.take');

  // Tap a note to hear its true pitch (reuses the practice reference-tone player).
  const tonePlayer = useMemo(() => createReferenceTonePlayer(), []);
  useEffect(() => () => tonePlayer.stop(), [tonePlayer]);
  const playNote = useCallback(
    (midi: number) => {
      tonePlayer.play([{ midi, startMs: 0, endMs: TAP_NOTE_MS }]);
    },
    [tonePlayer]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.content}>
        <Text style={[styles.heading, { color: colors.typography }]}>
          {t('results.title')}
        </Text>

        <ScoreCard
          noteCount={notes.length}
          durationMs={handle.durationMs}
          score={score}
        />

        <FeedbackCard feedback={feedback} />

        <View style={styles.listWrap}>
          <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
            {t('results.notesSection')}
          </Text>
          <NoteList notes={notes} onPressNote={playNote} />
        </View>

        <ExportSheet midiUri={midiUri} title={title} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 20, gap: 16 },
  heading: { fontSize: 28, fontWeight: '700' },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  listWrap: { flex: 1 }
});
