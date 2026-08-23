/**
 * NoteShapeControls — everything under the graph that decides how you hear it.
 *
 * Split from NoteShapeSection, which was carrying both the drawing and the
 * controls and had outgrown the file budget. It is also a real seam: sideways
 * the graph takes the whole screen and none of this is shown, so the section
 * leaves it out entirely rather than hiding it.
 *
 * Three questions in order — which reading you hear, how loudly it sits
 * against the take, and which register it plays in — followed by what the
 * graph will not claim on its own.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { HearItAs } from './HearItAs';
import { MelodyMix } from './MelodyMix';
import { MelodyOctave } from './MelodyOctave';
import type { useNoteDetail } from './useNoteDetail';

export interface NoteShapeControlsProps {
  detail: ReturnType<typeof useNoteDetail>;
}

export function NoteShapeControls({
  detail
}: NoteShapeControlsProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { hasGrid, meterIsStated } = detail;

  return (
    <>
      <View style={styles.hearAs}>
        <HearItAs
          mode={detail.playbackMode}
          onChange={detail.setPlaybackMode}
          onPlay={detail.playMelody}
          onStop={detail.stopMelody}
          isPlaying={detail.isMelodyPlaying}
          canNotate={hasGrid}
        />
        <MelodyMix
          level={detail.melodyLevel}
          onLevelChange={detail.setMelodyLevel}
        />
        <MelodyOctave
          octaves={detail.octaves}
          range={detail.octaveRange}
          onShift={detail.shiftOctave}
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
  );
}

export default NoteShapeControls;

const styles = StyleSheet.create({
  hearAs: { marginTop: 12, gap: 12 },
  caption: { fontSize: 12, marginTop: 8 }
});
