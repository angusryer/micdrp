/**
 * NoteShapeSection — the melody graph and what sounds it.
 *
 * The piece the landscape layout hands the whole screen to, which is why it
 * takes its own size rather than reading the window: upright it is a band in
 * a scrolling column, sideways it is the view.
 *
 * It has no border and no rounded corners. Every pixel of width is a moment
 * of the take, and framing the drawing spent them on a frame — so it runs to
 * the edges of whatever it is given (INV-NOTES-101).
 */
import { type SharedValue } from 'react-native-reanimated';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { octaveLabel } from 'logic';

import { GraphLayers } from './GraphLayers';
import { RhythmBand, rhythmBandHeight } from '../../components/RhythmBand';
import type { Chosen, Selection } from '../../components/graphSelection';
import { MelodyView } from '../../components/MelodyView';
import { ZoomableMelody } from '../../components/ZoomableMelody';
import { chosenMomentMs } from './chosenMoment';
import { PlayRangeOverlay } from '../../components/PlayRangeOverlay';
import { useListenBack } from './useListenBack';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ChordTrack } from './ChordTrack';
import { NoteShapeControls } from './NoteShapeControls';
import { Playhead } from './Playhead';
import { TrackRail, TRACK_RAIL_WIDTH } from './TrackRail';
import { Scrubber } from './Scrubber';
import type { useNoteDetail } from './useNoteDetail';
import type { Hit } from 'logic';

/**
 * Room for one row of chord cards under the drawing, inside the same card.
 *
 * Sized to the cards, which are sized like the transport's own controls: the
 * strip is a reading of the take, not the main event on the screen.
 */
const CHORD_STRIP_HEIGHT = 40;

/** Below this the drawing stops being a graph, so it refuses to shrink more. */
export const MIN_GRAPH_HEIGHT = 96;

/**
 * The strip above the drawing that carries the scrubber.
 *
 * Its own band rather than an overlay: a handle drawn over the graph covers
 * the notes it is pointing at, which are the thing being looked at
 * (INV-NOTES-081). Tall enough to tap anywhere along, since tapping it is how
 * the head is placed (INV-NOTES-091).
 */
const SCRUB_BAND_HEIGHT = 34;

export interface NoteShapeSectionProps {
  /**
   * What was struck, tapped and read together. Given, it replaces the note's
   * own — the pad's hits are not stored until committed, and the band has to
   * show them while they are being placed (INV-NOTES-129).
   */
  hits?: readonly Hit[];
  detail: ReturnType<typeof useNoteDetail>;
  width: number;
  /** The whole card, chord strip included — not just the drawing. */
  height: number;
  /** Sideways the graph is the view, so the controls under it are left off. */
  showControls?: boolean;
  /** What is chosen on the graph, and how to choose something else. */
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
  flashing?: Selection | null;
  /** Where the take is, and how to go elsewhere in it (INT-NOTES-022). */
  /** Open what governs every track (INT-NOTES-021), from the rail's foot. */
  onOptions?: () => void;
  /** Open the note's readings and analysis, from above the drawing. */
  onDetails?: () => void;
  transport?: {
    /**
     * The moment, read every frame on the UI thread. The only shape it
     * comes in: a number that ticks used to be here too, and publishing
     * it re-rendered this whole screen twice a second (INV-TPORT-002).
     */
    drawnPositionMs: SharedValue<number>;
    seek: (ms: number) => void;
    /**
     * Taking hold of the head for a drag and putting it down again
     * (INV-TPORT-018). A gesture sends these rather than a seek a frame.
     */
    grabHead?: () => void;
    dropHead?: (ms: number) => void;
    /** Whether the take is sounding, so the view follows only then. */
    isPlaying?: boolean;
    play?: () => void;
    stop?: () => void;
  } | null;
}

export function NoteShapeSection({
  detail,
  width,
  height,
  hits: hitsGiven,
  showControls = true,
  selection,
  onSelect,
  flashing,
  onOptions,
  onDetails,
  transport
}: NoteShapeSectionProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hits = hitsGiven ?? detail.hits;
  // Offered only once the scale has been moved off the one the take opened
  // at, since a reset that does nothing is noise (INV-NOTES-044). Kept as a
  // boolean rather than the callback itself: React drops a set that does not
  // change the value, so a pinch that stays zoomed re-renders nothing.
  const [canReset, setCanReset] = useState(false);
  const resetScale = useRef<() => void>(() => {});
  const onScaleChange = useCallback(
    (state: { isDefault: boolean; reset: () => void }) => {
      resetScale.current = state.reset;
      setCanReset(!state.isDefault);
    },
    []
  );
  const {
    shownMelody: melody,
    gridForView,
    chordPitchesShown,
    heardPitches,
    chords,
    bass,
    octaves
  } = detail;
  // The bass shares the melody's pitch window, so its notes are declared to
  // the layout that decides that window (INV-NOTES-079).
  /**
   * The way to bring a moment into view, handed out by the graph.
   *
   * A note chosen by touch is in view by definition; one chosen from the
   * sheet's list, or left behind by a scroll, is not — and it is about to be
   * described in a sheet, which is the one moment it is wanted (INV-NOTES-177).
   */
  const [viewport, setViewport] = useState<{
    bringIntoView: (atMs: number) => void;
  } | null>(null);
  const chosenAtMs = useMemo(
    () => chosenMomentMs(detail.selection, melody),
    [detail.selection, melody]
  );
  useEffect(() => {
    if (chosenAtMs != null) {
      viewport?.bringIntoView(chosenAtMs);
    }
  }, [chosenAtMs, viewport]);

  // A stretch to listen back to, marked when something is retimed
  // (INV-NOTES-178). Its own hook, since it is the only thing that knows both
  // the take's transport and what an edit did.
  const listenBack = useListenBack({
    transport,
    durationMs: detail.note?.durationMs ?? 0,
    retimed: detail.retimed,
    selection: detail.selection
  });

  // What was heard is declared alongside them, so the window never closes in
  // below the take when a note is corrected downwards (INV-NOTES-174).
  const shownWith = useMemo(
    () => [
      ...chordPitchesShown,
      ...heardPitches,
      ...(bass ?? []).map((n) => n.midi)
    ],
    [chordPitchesShown, heardPitches, bass]
  );
  // The cards ride in the graph's own scroll so each one starts where its
  // chord starts (INV-NOTES-061). They take their room out of the height this
  // section was given rather than adding to it, so the drawing shrinks by
  // exactly what they occupy and the section still fits its slot.
  const hasChords = chords.slots.length > 0;
  const stripHeight = hasChords ? CHORD_STRIP_HEIGHT : 0;
  // The drums take their room out of the same height everything else does, so
  // a take with rhythm in it does not grow taller than its slot — the drawing
  // gives way, as it does for the chord strip (INV-NOTES-060).
  const bandHeight = rhythmBandHeight(hits);
  const graphHeight = Math.max(
    MIN_GRAPH_HEIGHT,
    height - stripHeight - bandHeight - SCRUB_BAND_HEIGHT
  );
  // The graph never moves for a transposition — the take was sung where it
  // was sung. This is the only sign of it, and only while it is not zero
  // (INV-NOTES-058).
  const shifted = octaveLabel(octaves);
  // The rail takes its room out of the drawing rather than out of the page:
  // the graph still reaches both edges of the card, and the strip is part of
  // the graph rather than something beside it (INV-NOTES-142).
  const drawingWidth = Math.max(
    0,
    width - (detail.railTracks.length > 0 ? TRACK_RAIL_WIDTH : 0)
  );

  return (
    <>
      {onDetails != null ? (
        <View style={styles.aboveGraph}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('notes.detailTitle')}
            testID="open-analysis"
            onPress={onDetails}
            hitSlop={8}
            style={({ pressed }) => [
              styles.analysis,
              { opacity: pressed ? 0.5 : 1 }
            ]}
          >
            <Icon name="details" size={20} color={colors.gray300} />
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.neutral50 }]}>
        {/* Beside the drawing and outside its scroll, so it is the same
            distance from every part of the take (INV-NOTES-142). */}
        <View style={styles.withRail}>
          <TrackRail
            tracks={detail.railTracks}
            mix={detail.listening.mix}
            height={graphHeight + SCRUB_BAND_HEIGHT + stripHeight + bandHeight}
            onToggle={detail.listening.setAudible}
            isSnapping={detail.listening.snapToGrid}
            onSnapping={detail.listening.setSnapToGrid}
            onOptions={onOptions}
          />
          <View style={styles.drawing}>
        {/* A beat is a fixed width here and the take scrolls past the screen,
            so a bar is the same size in every take and wide enough to put a
            finger on (INV-NOTES-032). Without a grid there is no beat to
            hold, so it falls back to the fitted view. */}
        {gridForView != null ? (
          <ZoomableMelody
            notes={melody}
            grid={gridForView}
            width={drawingWidth}
            height={graphHeight}
            alsoShow={shownWith}
            underlay={bass}
            underlayColor={colors.gold}
            fromMs={0}
            // The whole recording, so a take that ran on after the last
            // note is not drawn as one that stopped there (INV-NOTES-108).
            toMs={detail.note?.durationMs}
            // Marked, not hidden: they were sung (INV-NOTES-113).
            countedNotes={detail.countedNotes}
            headerHeight={SCRUB_BAND_HEIGHT}
            header={({ contentWidth, timeAxis, firstNoteMs }) =>
              transport != null ? (
                <Scrubber
                  positionMs={transport.drawnPositionMs}
                  timeAxis={timeAxis}
                  contentWidth={contentWidth}
                  height={SCRUB_BAND_HEIGHT}
                  firstNoteMs={firstNoteMs}
                  onSeek={transport.seek}
                  onGrab={transport.grabHead}
                  onRelease={transport.dropHead}
                />
              ) : null
            }
            onScaleChange={onScaleChange}
            onViewport={setViewport}
            // The same value the head is drawn from, so the view and the head
            // cannot disagree about where the take has reached (INV-NOTES-193).
            followMs={transport?.drawnPositionMs}
            isFollowing={transport?.isPlaying ?? false}
            // The rhythm band is part of the drawing rather than below it:
            // one surface reads every touch on the graph, and a struck sound
            // has to be selectable the same way a note is (INV-NOTES-118).
            underHeight={bandHeight}
            footerHeight={stripHeight}
            footer={({ contentWidth, timeAxis, zoomBy }) => (
              <ChordTrack
                slots={chords.slots}
                timeAxis={timeAxis}
                contentWidth={contentWidth}
                onReveal={zoomBy}
                onNudge={chords.nudge}
                onReshape={chords.reshape}
                onAudition={detail.auditionChord}
                onRevert={chords.revert}
              />
            )}
          >
            {({
              contentWidth,
              timeAxis,
              pitchAxis,
              rects,
              underRects,
              underHeight
            }) => (
              <>
                {/* Drawn in the room below the melody, on the same axis and
                    under the same touch surface (INV-NOTES-117). */}
                <View style={{ marginTop: graphHeight }}>
                  <RhythmBand
                    hits={hits}
                    timeAxis={timeAxis}
                    contentWidth={contentWidth}
                    height={underHeight}
                  />
                </View>
                <GraphLayers
                  detail={detail}
                  noteRects={rects}
                  noteRectsUnder={underRects}
                  underHeight={underHeight}
                  contentWidth={contentWidth}
                  height={graphHeight}
                  timeAxis={timeAxis}
                  pitchAxis={pitchAxis}
                  selection={selection}
                  onSelect={onSelect}
                  flashing={flashing}
                />
                <PlayRangeOverlay
                  range={listenBack.range}
                  timeAxis={timeAxis}
                  height={graphHeight}
                  shade={colors.neutral50}
                  fromColor={colors.gold}
                  toColor={colors.primary500}
                  controlColor={colors.gold}
                  onMoveEnd={listenBack.moveEnd}
                  onPlay={listenBack.playRange}
                  isPlaying={listenBack.isPlaying}
                />
                {/* Last, so the moment reads over the notes it is passing
                    rather than behind them (INV-NOTES-100). */}
                {transport != null ? (
                  <Playhead
                    positionMs={transport.drawnPositionMs}
                    timeAxis={timeAxis}
                    contentWidth={contentWidth}
                    height={graphHeight}
                  />
                ) : null}
              </>
            )}
          </ZoomableMelody>
        ) : (
          <MelodyView notes={melody} width={drawingWidth} height={graphHeight} />
        )}
          </View>
        </View>
        {shifted != null ? (
          <View
            style={[styles.octaveBadge, { backgroundColor: colors.neutral100 }]}
          >
            <Text
              accessibilityLabel={t('notes.octaveShifted', { label: shifted })}
              style={[styles.octaveText, { color: colors.primary500 }]}
            >
              {shifted}
            </Text>
          </View>
        ) : null}
        {/* On the graph rather than under it. Below the card it was one more
            thing the sideways layout had to know about and subtract, and it
            is a control for the drawing either way (INV-NOTES-060). */}
        {canReset ? (
          <Text
            accessibilityRole="button"
            onPress={() => resetScale.current()}
            style={[
              styles.reset,
              { color: colors.primary500, backgroundColor: colors.neutral100 }
            ]}
          >
            {t('notes.zoomReset')}
          </Text>
        ) : null}
      </View>

      {showControls ? <NoteShapeControls detail={detail} /> : null}
    </>
  );
}

export default NoteShapeSection;

const styles = StyleSheet.create({
  // No border and no radius: the drawing runs to the edges of its slot
  // (INV-NOTES-101).
  // The rail and the drawing sit side by side with nothing between them:
  // they are one instrument, and a gap would read as two panels.
  // Above the drawing and hard right: it opens a reading OF the graph, so it
  // belongs to the graph without being in it.
  aboveGraph: { alignItems: 'flex-end', paddingRight: 4 },
  analysis: { padding: 6 },
  withRail: { flexDirection: 'row' },
  drawing: { flex: 1 },
  card: { overflow: 'hidden' },
  octaveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    opacity: 0.9
  },
  octaveText: { fontSize: 11, fontWeight: '700' },
  reset: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    opacity: 0.9
  }
});
