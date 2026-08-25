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
import { TrackOptions } from './TrackOptions';
import { BeatTap } from './BeatTap';
import { SelectionSheet } from './SelectionSheet';
import { formatDuration } from './NoteStats';
import { PlaybackBar } from './PlaybackBar';
import { useNoteDetail } from './useNoteDetail';

/** Side padding of the detail scroll content (keep in sync with styles.content). */
const CONTENT_PADDING = 20;
/**
 * How much of the screen the graph takes upright: the drawing, the scrubber's
 * band and the row of chord cards that rides in its scroll.
 *
 * Half the screen rather than a fixed number of points. It is the thing the
 * page is about, and a constant that read well on one phone was a third of
 * the screen on a large one and most of it on a small one (INV-NOTES-106).
 */
const GRAPH_SHARE_OF_SCREEN = 0.5;

/** Below this it stops being a graph, whatever the screen is. */
const MIN_GRAPH_CARD = 204;

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
  // What the selection sheet is covering, so the page can be scrolled clear
  // of it. It sits over a live page rather than a dimmed one, and a page
  // whose bottom row cannot be reached is live in name only (INV-NOTES-109).
  const [sheetCover, setSheetCover] = useState(0);

  const [transport, setTransport] = useState<{
    positionMs: number;
    isPlaying: boolean;
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
    return <NoteLandscape detail={detail} />;
  }

  // The full screen, not the padded column. Every pixel of width is a moment
  // of the take, so the graph breaks out of the page's margins rather than
  // spending them on white space (INV-NOTES-101).
  const graphWidth = width;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          sheetCover > 0 ? { paddingBottom: sheetCover } : null
        ]}
      >
        <Text style={[styles.title, { color: colors.typography }]}>
          {note.title}
        </Text>

        {note.audioPath ? (
          <PlaybackBar
            resolveAudioUri={detail.resolveAudio}
            durationLabel={formatDuration(note.durationMs)}
            accompaniment={detail.backdrop}
            voice={detail.melodyVoiceMix}
            listening={detail.listening}
            count={detail.countMix}
            rhythm={detail.rhythmMix}
            beats={detail.clickBeats}
            onDetails={() => setShowDetails(true)}
            onTransport={setTransport}
            trackOptions={(track) => (
              <TrackOptions detail={detail} track={track} />
            )}
          />
        ) : null}

        {melody.length > 0 ? (
          <>
            {/* The word "Shape" said what the picture already says; the top
                edge of the graph carries the scrubber instead
                (INT-NOTES-022). */}
            <View style={styles.fullBleed}>
              <NoteShapeSection
                detail={detail}
                width={graphWidth}
                height={Math.max(
                  MIN_GRAPH_CARD,
                  Math.round(height * GRAPH_SHARE_OF_SCREEN)
                )}
                transport={transport}
                selection={detail.selection}
                onSelect={detail.setSelection}
                flashing={detail.flashing}
              />
            </View>
            <SelectionSheet
              detail={detail}
              selection={detail.selection}
              onSelect={detail.setSelection}
              onCover={setSheetCover}
            />

            {/* The take plays while the layer is sung over it — that is what
                makes it a layer rather than a second recording. */}
            {/* Stamped against where the take has reached, so a tapped beat
                lands on the same timeline as everything else sounding
                (INV-NOTES-126). Armed only while something is actually
                running (INV-NOTES-130). */}
            {/* Each run of the take is one pass, and a pass replaces the one
                before it (INV-NOTES-131). */}
            <BeatTap
              isArmed={transport?.isPlaying === true}
              count={detail.beats.length}
              bpm={detail.tappedBpm}
              onTap={() => detail.tapBeat(transport?.positionMs ?? 0)}
              onArm={detail.beginTapPass}
              onClear={detail.clearBeats}
            />

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
  // Out through the page's own margins, to the edges of the screen.
  fullBleed: { marginHorizontal: -CONTENT_PADDING },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginTop: 18 },
  details: { fontSize: 14, fontWeight: '600', marginTop: 20 }
});
