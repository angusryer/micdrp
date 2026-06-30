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
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { ExportSheet } from './ExportSheet';
import { NoteList } from './NoteList';
import { ScoreCard } from './ScoreCard';
import { useResults } from './useResults';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export default function ResultsScreen({ route }: Props) {
  const { colors } = useTheme();
  const { handle } = route.params;

  const { notes, score, midiUri, meta } = useResults(handle);
  const title = meta?.title ?? 'Take';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <View style={styles.content}>
        <Text style={[styles.heading, { color: colors.typography }]}>Results</Text>

        <ScoreCard
          noteCount={notes.length}
          durationMs={handle.durationMs}
          score={score}
        />

        <View style={styles.listWrap}>
          <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>Notes</Text>
          <NoteList notes={notes} />
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
