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
import { InstrumentDeck } from './InstrumentDeck';
import { NoteNeckSection } from './NoteNeckSection';
import { NoteShapeSection } from './NoteShapeSection';
import { TrackOptions } from './TrackOptions';
import { BeatTap } from './BeatTap';
import { nextStep } from 'logic';

import { WorkflowStrip } from './WorkflowStrip';
import { SelectionSheet } from './SelectionSheet';
import { PlaybackBar } from './PlaybackBar';
import { useNoteDetail } from './useNoteDetail';
import type { PlaybackState } from './usePlayback';
import { useGraphRoom } from './useGraphRoom';

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
  // Held here because the control that opens it lives on the graph's edge and
  // the sheet itself lives in the transport (INV-NOTES-142).
  const [showOptions, setShowOptions] = useState(false);
  // What whichever sheet is up is covering, so the page can be scrolled clear
  // of it. It sits over a live page rather than a dimmed one, and a page
  // whose bottom row cannot be reached is live in name only (INV-NOTES-109).
  const { cover: sheetCover, report: reportCover } = useSheetCover();
  // A sheet is opened over a note to work on that note, so the note stays on
  // the screen: the page comes to the graph and the graph takes the room left
  // above the sheet (INV-NOTES-226).
  const room = useGraphRoom({
    coveredPx: sheetCover,
    usualPx: Math.round(height * GRAPH_SHARE_OF_SCREEN)
  });

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
    /** From a chosen moment, without the lead-in (INT-NOTES-032). */
    playFrom: (ms: number) => void;
    stop: () => void;
    /** What the rail's copy of the transport draws (INV-NOTES-227). */
    state: PlaybackState;
    pause: () => void;
    rewind: () => void;
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
        ref={room.scrollRef}
        onLayout={room.onViewportLayout}
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
            accompaniment={detail.backdrop}
            voice={detail.melodyVoiceMix}
            listening={detail.listening}
          takeMakeUp={detail.takeMakeUp}
            sungDb={detail.sungDb}
            count={detail.countMix}
            earliestMs={detail.pickupStartMs}
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
            {/* Where the take is and what comes next, above everything
                else: the take leads and the person follows (INV-NOTES-267).
                Nothing at all once the take has everything. */}
            <WorkflowStrip
              step={nextStep({
                hasPickup: detail.pickup != null,
                hasBassline: detail.bass != null,
                hasHarmony: detail.hasHarmony
              })}
              countIn={{
                onPlay: () => transport?.play(),
                onStop: () => transport?.stop(),
                atMs: () => transport?.drawnPositionMs.value ?? 0,
                onMake: detail.makePickup
              }}
              isRecording={detail.layerCapture.isRecording}
              onRecord={() => {
                if (detail.layerCapture.isRecording) {
                  transport?.stop();
                  void detail.layerCapture.stop();
                  return;
                }
                // Recording first, then playback from the count-in's first
                // beat, so the count is what counts the layer in
                // (INT-NOTES-032).
                void detail.layerCapture
                  .start('bass')
                  .then(() => transport?.playFrom(detail.pickupStartMs));
              }}
              onChords={() => {
                if (!detail.hasHarmony) {
                  detail.toggleHarmony();
                }
              }}
            />
            <View style={styles.fullBleed} onLayout={room.onGraphLayout}>
              <NoteShapeSection
                detail={detail}
                onOptions={() => setShowOptions(true)}
                onDetails={() => setShowDetails(true)}
                width={graphWidth}
                height={room.graphHeight}
                transport={transport}
                selection={detail.selection}
                onSelect={detail.setSelection}
                flashing={detail.flashing}
              />
            </View>
            {/* Directly under the graph, because it is the same phrase said
                the other way: the graph is what was sung, this is where to
                put your hands to sing it back (INV-NOTES-150). One of
                several, swiped through (INV-NOTES-151). */}
            <InstrumentDeck width={graphWidth - CONTENT_PADDING * 2}>
              <NoteNeckSection
                melody={detail.shownMelody}
                width={graphWidth - CONTENT_PADDING * 2}
                positionMs={transport?.drawnPositionMs}
              />
            </InstrumentDeck>

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
        transport={
          transport != null
            ? {
                play: () => transport.play(),
                stop: () => transport.stop(),
                atMs: () => transport.drawnPositionMs.value
              }
            : null
        }
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
