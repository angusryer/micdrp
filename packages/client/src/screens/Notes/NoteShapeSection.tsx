/**
 * NoteShapeSection — the melody graph and what sounds it.
 *
 * The piece the landscape layout hands the whole screen to, which is why it
 * takes its own size rather than reading the window: upright it is a card in
 * a scrolling column, sideways it is the view.
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { octaveLabel } from 'logic';

import { GraphLayers } from './GraphLayers';
import type { Selection } from '../../components/graphSelection';
import { MelodyView } from '../../components/MelodyView';
import { ZoomableMelody } from '../../components/ZoomableMelody';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ChordTrack } from './ChordTrack';
import { NoteShapeControls } from './NoteShapeControls';
import type { useNoteDetail } from './useNoteDetail';

/**
 * Room for one row of chord cards under the drawing, inside the same card.
 *
 * Sized to the cards, which are sized like the transport's own controls: the
 * strip is a reading of the take, not the main event on the screen.
 */
const CHORD_STRIP_HEIGHT = 52;

/** Below this the drawing stops being a graph, so it refuses to shrink more. */
export const MIN_GRAPH_HEIGHT = 96;

export interface NoteShapeSectionProps {
  detail: ReturnType<typeof useNoteDetail>;
  width: number;
  /** The whole card, chord strip included — not just the drawing. */
  height: number;
  /** Sideways the graph is the view, so the controls under it are left off. */
  showControls?: boolean;
  /** What is chosen on the graph, and how to choose something else. */
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
}

export function NoteShapeSection({
  detail,
  width,
  height,
  showControls = true,
  selection,
  onSelect
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
    octaves
  } = detail;
  // The cards ride in the graph's own scroll so each one starts where its
  // chord starts (INV-NOTES-061). They take their room out of the height this
  // section was given rather than adding to it, so the drawing shrinks by
  // exactly what they occupy and the section still fits its slot.
  const hasChords = chords.slots.length > 0;
  const stripHeight = hasChords ? CHORD_STRIP_HEIGHT : 0;
  const graphHeight = Math.max(MIN_GRAPH_HEIGHT, height - stripHeight);
  // The graph never moves for a transposition — the take was sung where it
  // was sung. This is the only sign of it, and only while it is not zero
  // (INV-NOTES-058).
  const shifted = octaveLabel(octaves);

  return (
    <>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.neutral50, borderColor: colors.neutral500 }
        ]}
      >
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
            alsoShow={chordPitchesShown}
            onScaleChange={onScaleChange}
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
            {({ contentWidth, beatWidth, timeAxis, pitchAxis, rects }) => (
              <GraphLayers
                detail={detail}
                noteRects={rects}
                contentWidth={contentWidth}
                beatWidth={beatWidth}
                height={graphHeight}
                timeAxis={timeAxis}
                pitchAxis={pitchAxis}
                selection={selection}
                onSelect={onSelect}
              />
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
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
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
