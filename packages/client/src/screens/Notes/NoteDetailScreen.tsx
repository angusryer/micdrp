/**
 * NoteDetailScreen — a single note's reframed analysis.
 *
 * A note is a musical-idea memo, so this is *analysis*, not a grade: detected
 * key, natural tempo, vocal range and intonation steadiness — plus the note
 * list (tap to hear each pitch) and a MIDI export. Play sounds the take and
 * the chord backdrop together, so the singer hears the harmony their line
 * implied rather than the bare recording — or either alone, whichever the
 * choice beside the play control is set to.
 *
 * Composition only. The state lives in useNoteDetail and each block of the
 * page is its own piece, so the graph can be handed a whole screen sideways
 * without any of this moving.
 */
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteList } from '../Results/NoteList';
import { NoteHarmonySection } from './NoteHarmonySection';
import { NoteLandscape } from './NoteLandscape';
import { NoteShapeSection } from './NoteShapeSection';
import { SelectionBar } from './SelectionBar';
import { NoteStats, formatDuration } from './NoteStats';
import { PlaybackBar } from './PlaybackBar';
import { useNoteDetail } from './useNoteDetail';

/** Side padding of the detail scroll content (keep in sync with styles.content). */
const CONTENT_PADDING = 20;
/** Height of the piano-roll melody view when it is a card in the column. */
/**
 * The whole graph card upright: the drawing plus the row of chord cards that
 * now rides in its scroll, so each card starts on its own downbeat.
 */
const MELODY_VIEW_HEIGHT = 236;

type Props = NativeStackScreenProps<RootStackParamList, 'NoteDetail'>;

export default function NoteDetailScreen({ route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const detail = useNoteDetail(route.params.id);
  const { note, melody } = detail;

  if (!note) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
        <View style={styles.missing}>
          <Text style={{ color: colors.gray300 }}>{t('notes.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Sideways, the graph is the view (INV-NOTES-041). Same state either way,
  // so turning the phone changes the presentation and nothing about the note.
  if (width > height && melody.length > 0) {
    return <NoteLandscape detail={detail} width={width} />;
  }

  const graphWidth = width - 2 * CONTENT_PADDING - 2;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {note.title}
        </Text>

        {note.audioPath ? (
          <PlaybackBar
            resolveAudioUri={detail.resolveAudio}
            durationLabel={formatDuration(note.durationMs)}
            accompaniment={detail.backdrop}
            voice={detail.melodyVoiceMix}
          />
        ) : null}

        {melody.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
              {t('notes.shape')}
            </Text>
            <NoteShapeSection
              detail={detail}
              width={graphWidth}
              height={MELODY_VIEW_HEIGHT}
              selection={detail.selection}
              onSelect={detail.setSelection}
            />
            <SelectionBar
              detail={detail}
              selection={detail.selection}
              onSelect={detail.setSelection}
            />

            <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
              {t('notes.harmony')}
            </Text>
            <NoteHarmonySection detail={detail} />
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
          {t('notes.analysis')}
        </Text>
        <NoteStats
          note={note}
          grid={detail.grid}
          hasGrid={detail.hasGrid}
          chordCount={detail.chords.slots.length}
        />

        <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
          {t('notes.notesTapToHear')}
        </Text>
        <NoteList notes={melody} onPressNote={detail.playNote} />

        <ExportSheet midiUri={detail.midiUri} title={note.title} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: CONTENT_PADDING, gap: 8 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 18 }
});
