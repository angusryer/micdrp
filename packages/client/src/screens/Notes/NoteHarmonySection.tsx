/**
 * NoteHarmonySection — what to say about the backdrop, and where it sits.
 *
 * The cards themselves moved onto the graph, under the bars they describe
 * (INV-NOTES-061); a second copy here would be a second thing to keep in step
 * with the take. What is left is the reading that has no place on the drawing:
 * how to change a chord, which register the backdrop occupies, and the way
 * back to what was heard.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { useNoteDetail } from './useNoteDetail';

export interface NoteHarmonySectionProps {
  detail: ReturnType<typeof useNoteDetail>;
}

export function NoteHarmonySection({
  detail
}: NoteHarmonySectionProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { chords } = detail;

  if (chords.slots.length === 0) {
    return (
      <Text style={[styles.caption, { color: colors.gray300 }]}>
        {t('notes.harmonyNone')}
      </Text>
    );
  }

  return (
    <>
      <Text style={[styles.caption, { color: colors.gray300 }]}>
        {t('notes.harmonyHint')}
      </Text>
      {/* Which register the chords occupy, which is really a question about
          what you are listening on. */}
      <Text
        accessibilityRole="button"
        accessibilityState={{ selected: detail.chordsLifted }}
        onPress={detail.toggleChordsLifted}
        style={[styles.caption, { color: colors.primary500 }]}
      >
        {t(detail.chordsLifted ? 'notes.chordsLifted' : 'notes.chordsLow')}
      </Text>
      {chords.hasEdits ? (
        <Text
          accessibilityRole="button"
          onPress={chords.revertAll}
          style={[styles.action, { color: colors.primary500 }]}
        >
          {t('notes.harmonyReset')}
        </Text>
      ) : null}
    </>
  );
}

export default NoteHarmonySection;

const styles = StyleSheet.create({
  caption: { fontSize: 12, marginTop: 8 },
  action: { fontSize: 14, fontWeight: '600', marginTop: 10 }
});
