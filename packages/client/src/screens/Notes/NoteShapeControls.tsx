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
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { useNoteDetail } from './useNoteDetail';

export interface NoteShapeControlsProps {
  detail: ReturnType<typeof useNoteDetail>;
}

export function NoteShapeControls({
  detail
}: NoteShapeControlsProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { hasGrid } = detail;

  return (
    <>
      {/* Nothing is said when the metre is only assumed. It always is, on a
          short sung idea, so the line appeared on almost every take and told
          somebody looking at their own singing something they could neither
          act on nor turn off. The bar lines are movable; that is the answer
          to a wrong one. */}
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
  caption: { fontSize: 12, marginTop: 8 }
});
