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
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { octaveLabel } from 'logic';

import { GraphLayers } from './GraphLayers';
import { RhythmBand, rhythmBandHeight } from '../../components/RhythmBand';
import type { Chosen, Selection } from '../../components/graphSelection';
import { MelodyView } from '../../components/MelodyView';
import { ZoomableMelody } from '../../components/ZoomableMelody';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ChordTrack } from './ChordTrack';
import { NoteShapeControls } from './NoteShapeControls';
import { Playhead } from './Playhead';
import { Scrubber } from './Scrubber';
import type { useNoteDetail } from './useNoteDetail';

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
  transport?: { positionMs: number; seek: (ms: number) => void } | null;
}

export function NoteShapeSection({
  detail,
  width,
  height,
  showControls = true,
  selection,
  onSelect,
  flashing,
  transport
}: NoteShapeSectionProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
    chords,
    bass,
    octaves
  } = detail;
  // The bass shares the melody's pitch window, so its notes are declared to
  // the layout that decides that window (INV-NOTES-079).
  const shownWith = useMemo(
    () => [...chordPitchesShown, ...(bass ?? []).map((n) => n.midi)],
    [chordPitchesShown, bass]
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
  const bandHeight = rhythmBandHeight(detail.hits);
  const graphHeight = Math.max(
    MIN_GRAPH_HEIGHT,
    height - stripHeight - bandHeight - SCRUB_BAND_HEIGHT
  );
  // The graph never moves for a transposition — the take was sung where it
  // was sung. This is the only sign of it, and only while it is not zero
  // (INV-NOTES-058).
  const shifted = octaveLabel(octaves);

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.neutral50 }]}>
        {/* A beat is a fixed width here and the take scrolls past the screen,
            so a bar is the same size in every take and wide enough to put a
            finger on (INV-NOTES-032). Without a grid there is no beat to
            hold, so it falls back to the fitted view. */}
        {gridForView != null ? (
          <ZoomableMelody
            notes={melody}
            grid={gridForView}
            width={width}
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
                  positionMs={transport.positionMs}
                  timeAxis={timeAxis}
                  contentWidth={contentWidth}
                  height={SCRUB_BAND_HEIGHT}
                  firstNoteMs={firstNoteMs}
                  onSeek={transport.seek}
                />
              ) : null
            }
            onScaleChange={onScaleChange}
            footerHeight={stripHeight + bandHeight}
            footer={({ contentWidth, timeAxis, zoomBy }) => (
              <>
                {/* Above the chords and below the drawing: the drums are a
                    performance, and the chords are a reading of one
                    (INV-NOTES-117). */}
                <RhythmBand
                  hits={detail.hits}
                  timeAxis={timeAxis}
                  contentWidth={contentWidth}
                  height={bandHeight}
                />
                <View style={{ marginTop: bandHeight }}>
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
                </View>
              </>
            )}
          >
            {({ contentWidth, timeAxis, pitchAxis, rects }) => (
              <>
                <GraphLayers
                  detail={detail}
                  noteRects={rects}
                  contentWidth={contentWidth}
                  height={graphHeight}
                  timeAxis={timeAxis}
                  pitchAxis={pitchAxis}
                  selection={selection}
                  onSelect={onSelect}
                  flashing={flashing}
                />
                {/* Last, so the moment reads over the notes it is passing
                    rather than behind them (INV-NOTES-100). */}
                {transport != null ? (
                  <Playhead
                    positionMs={transport.positionMs}
                    timeAxis={timeAxis}
                    contentWidth={contentWidth}
                    height={graphHeight}
                  />
                ) : null}
              </>
            )}
          </ZoomableMelody>
        ) : (
          <MelodyView notes={melody} width={width} height={graphHeight} />
        )}
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
