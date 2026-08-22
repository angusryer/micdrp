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
import { NoteShapeControls } from './NoteShapeControls';
import type { useNoteDetail } from './useNoteDetail';

export interface NoteShapeSectionProps {
  detail: ReturnType<typeof useNoteDetail>;
  width: number;
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
    melody,
    gridForView,
    chordPitchesShown,
    octaves
  } = detail;
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
            height={height}
            alsoShow={chordPitchesShown}
            onScaleChange={onScaleChange}
          >
            {({ contentWidth, beatWidth, timeAxis, pitchAxis, rects }) => (
              <GraphLayers
                detail={detail}
                noteRects={rects}
                contentWidth={contentWidth}
                beatWidth={beatWidth}
                height={height}
                timeAxis={timeAxis}
                pitchAxis={pitchAxis}
                selection={selection}
                onSelect={onSelect}
              />
            )}
          </ZoomableMelody>
        ) : (
          <MelodyView notes={melody} width={width} height={height} />
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
      </View>

      {canReset ? (
        <Text
          accessibilityRole="button"
          onPress={() => resetScale.current()}
          style={[styles.reset, { color: colors.primary500 }]}
        >
          {t('notes.zoomReset')}
        </Text>
      ) : null}

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
  reset: { fontSize: 12, fontWeight: '600', marginTop: 8, alignSelf: 'flex-end' }
});
