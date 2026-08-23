/**
 * NoteShapeControls — what stays under the graph once the choices have gone.
 *
 * Split from NoteShapeSection, which was carrying both the drawing and the
 * controls and had outgrown the file budget. It is also a real seam: sideways
 * the graph takes the whole screen and none of this is shown, so the section
 * leaves it out entirely rather than hiding it.
 *
 * Which reading you hear and which you see are now toggles in the playback
 * options with the tracks (INV-NOTES-026). What is left is the one control
 * here that makes a sound — nothing in those options does (INT-NOTES-021) —
 * and what the graph will not claim on its own.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { MelodyPlayToggle } from './MelodyPlayToggle';
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
        <MelodyPlayToggle
          isPlaying={detail.isMelodyPlaying}
          mode={detail.playbackMode}
          onPlay={detail.playMelody}
          onStop={detail.stopMelody}
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
