/**
 * NoteShapeSection — the melody graph and what sounds it.
 *
 * The piece the landscape layout hands the whole screen to, which is why it
 * takes its own size rather than reading the window: upright it is a card in
 * a scrolling column, sideways it is the view.
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GraphLayers } from './GraphLayers';
import type { Selection } from '../../components/graphSelection';
import { MelodyView } from '../../components/MelodyView';
import { ZoomableMelody } from '../../components/ZoomableMelody';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { HearItAs } from './HearItAs';
import { MelodyMix } from './MelodyMix';
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
    hasGrid,
    meterIsStated
  } = detail;

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

      {showControls ? (
        <>
          <View style={styles.hearAs}>
            <HearItAs
              mode={detail.playbackMode}
              onChange={detail.setPlaybackMode}
              onPlay={detail.playMelody}
              canNotate={hasGrid}
            />
            <MelodyMix
              isOverTake={detail.isOverTake}
              onOverTakeChange={detail.setIsOverTake}
              level={detail.melodyLevel}
              onLevelChange={detail.setMelodyLevel}
            />
          </View>
          {/* Say when the bar lines are an assumption rather than a reading. A
              short sung idea often does not state its metre, and drawing
              confident bar lines over one would be inventing information. */}
          {hasGrid && !meterIsStated ? (
            <Text style={[styles.caption, { color: colors.gray300 }]}>
              {t('notes.gridAssumed')}
            </Text>
          ) : null}
          {!hasGrid ? (
            <Text style={[styles.caption, { color: colors.gray300 }]}>
              {t('notes.gridNone')}
            </Text>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export default NoteShapeSection;

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  hearAs: { marginTop: 12, gap: 12 },
  caption: { fontSize: 12, marginTop: 8 },
  reset: { fontSize: 12, fontWeight: '600', marginTop: 8, alignSelf: 'flex-end' }
});
