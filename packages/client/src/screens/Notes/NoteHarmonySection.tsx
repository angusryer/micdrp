/**
 * NoteHarmonySection — the chord track, its hints, and where the backdrop
 * sits.
 *
 * The cards remain the way to change a whole chord: nudge it through the key,
 * step its shape, hear it, put it back. Moving one note of a chord happens on
 * the graph itself, where the note is.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { ChordTrack } from './ChordTrack';
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
      <ChordTrack
        slots={chords.slots}
        onNudge={chords.nudge}
        onReshape={chords.reshape}
        onAudition={detail.auditionChord}
        onRevert={chords.revert}
      />
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
