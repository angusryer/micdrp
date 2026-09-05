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
import { type SharedValue } from 'react-native-reanimated';
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
import { hasTakeAudio } from '../../data/takeAudio';
import { useSheetCover } from './useSheetCover';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { NoteDetailsPage } from './NoteDetailsPage';
import { NoteHarmonySection } from './NoteHarmonySection';
import { NoteLandscape } from './NoteLandscape';
import { NoteNeckSection } from './NoteNeckSection';
import { NoteShapeSection } from './NoteShapeSection';
import { useNeckShown } from './useNeckShown';
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
  // Kept with the note, so a neck put away stays away for it (INV-NOTES-151).
  const { neckShown, setNeckShown } = useNeckShown(route.params.id);
  // Held here so the graph's scrubber and the transport under it are the same
  // clock rather than two readings of one take (INT-NOTES-022).
  const [showDetails, setShowDetails] = useState(false);
  // Held here because the control that opens it lives on the graph's edge and
  // the sheet itself lives in the transport (INV-NOTES-142).
  const [showOptions, setShowOptions] = useState(false);
  // What whichever sheet is up is covering, so the page can be scrolled clear
  // of it. It sits over a live page rather than a dimmed one, and a page
  // whose bottom row cannot be reached is live in name only (INV-NOTES-109).
  const { cover: sheetCover, report: reportCover } = useSheetCover();

  /**
   * What the transport offers this screen.
   *
   * No ticking position. One used to be here, and it changed twice a
   * second while a take ran — so every reading of the clock re-rendered
   * this whole screen, graph and neck and chord track, faster than it
   * could draw. The moment arrives on the UI thread instead
   * (INV-NOTES-206).
   */
  const [transport, setTransport] = useState<{
    drawnPositionMs: SharedValue<number>;
    isPlaying: boolean;
    seek: (ms: number) => void;
    /** A drag takes hold of the head and puts it down (INV-TPORT-018). */
    grabHead: () => void;
    dropHead: (ms: number) => void;
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

        {hasTakeAudio(note) ? (
          <PlaybackBar
            resolveAudioUri={detail.resolveAudio}
            durationLabel={formatDuration(note.durationMs)}
            accompaniment={detail.backdrop}
            voice={detail.melodyVoiceMix}
            listening={detail.listening}
            count={detail.countMix}
            rhythm={detail.rhythmMix}
            layers={detail.layerVoices}
            bass={detail.bassMix}
            beats={detail.clickBeats}
            isOptionsOpen={showOptions}
            onOptionsOpen={setShowOptions}
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
                onOptions={() => setShowOptions(true)}
                onDetails={() => setShowDetails(true)}
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
            {/* Directly under the graph, because it is the same phrase said
                the other way: the graph is what was sung, this is where to
                put your fingers to sing it back (INV-NOTES-150). */}
            <NoteNeckSection
              melody={detail.shownMelody}
              width={graphWidth - CONTENT_PADDING * 2}
              isShown={neckShown}
              onShown={setNeckShown}
              positionMs={transport?.drawnPositionMs}
            />

            <SelectionSheet
              detail={detail}
              selection={detail.selection}
              onSelect={detail.setSelection}
              onCover={reportCover}
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
              // From the value the drawing reads, not the counter beside it.
              // The counter is refreshed a few times a second because it is
              // read to the second, so a tap could be recorded up to half a
              // second after the finger landed (INV-NOTES-162).
              onTap={() =>
                detail.tapBeat(transport?.drawnPositionMs.value ?? 0)
              }
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
        // The same room every other sheet asks for. This one covers the page
        // too, and did not say so — which is the fault INV-NOTES-109 was
        // written for, reappearing with the next sheet (INV-NOTES-181).
        onCover={reportCover}
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
