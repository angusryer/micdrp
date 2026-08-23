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
import React, { useState } from 'react';
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
import { NoteDetailsPage } from './NoteDetailsPage';
import { NoteHarmonySection } from './NoteHarmonySection';
import { NoteLandscape } from './NoteLandscape';
import { NoteShapeSection } from './NoteShapeSection';
import { PlaybackOptions } from './PlaybackOptions';
import { SelectionSheet } from './SelectionSheet';
import { formatDuration } from './NoteStats';
import { PlaybackBar } from './PlaybackBar';
import { useNoteDetail } from './useNoteDetail';

/** Side padding of the detail scroll content (keep in sync with styles.content). */
const CONTENT_PADDING = 20;
/** Height of the piano-roll melody view when it is a card in the column. */
/**
 * The whole graph card upright: the drawing plus the row of chord cards that
 * now rides in its scroll, so each card starts on its own downbeat.
 */
const MELODY_VIEW_HEIGHT = 204;

type Props = NativeStackScreenProps<RootStackParamList, 'NoteDetail'>;

export default function NoteDetailScreen({ route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const detail = useNoteDetail(route.params.id);
  const { note, melody } = detail;
  // Held here so the graph's scrubber and the transport under it are the same
  // clock rather than two readings of one take (INT-NOTES-022).
  const [showDetails, setShowDetails] = useState(false);
  const [transport, setTransport] = useState<{
    positionMs: number;
    seek: (ms: number) => void;
    play: () => void;
    stop: () => void;
  } | null>(null);

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
            onDetails={() => setShowDetails(true)}
            onTransport={setTransport}
            options={<PlaybackOptions detail={detail} />}
          />
        ) : null}

        {melody.length > 0 ? (
          <>
            {/* The word "Shape" said what the picture already says; the top
                edge of the graph carries the scrubber instead
                (INT-NOTES-022). */}
            <NoteShapeSection
              detail={detail}
              width={graphWidth}
              height={MELODY_VIEW_HEIGHT}
              transport={transport}
              selection={detail.selection}
              onSelect={detail.setSelection}
            />
            <SelectionSheet
              detail={detail}
              selection={detail.selection}
              onSelect={detail.setSelection}
            />

            {/* The take plays while the layer is sung over it — that is what
                makes it a layer rather than a second recording. */}
            <NoteHarmonySection
              detail={detail}
              onPlayTake={() => transport?.play()}
              onStopTake={() => transport?.stop()}
            />
          </>
        ) : null}
      </ScrollView>

      <NoteDetailsPage
        detail={detail}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: CONTENT_PADDING, gap: 8 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 18 },
  details: { fontSize: 14, fontWeight: '600', marginTop: 20 }
});
