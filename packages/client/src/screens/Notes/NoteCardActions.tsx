/**
 * NoteCardActions — the button row under a note card.
 *
 * Play is the singer's press to hear the take: it opens the card's playback
 * bar, which starts on mount, so this press is the press that makes sound
 * (INT-NOTES-010). A note whose audio was never stored gets no play button at
 * all rather than one that opens an empty row.
 *
 * The take's length sits on its own line directly above the row, aligned with
 * Play: it is the fact a singer wants right as they decide whether to press.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

export interface NoteCardActionsProps {
  /** Whether the playback bar is open — Play reads as Close while it is. */
  isPlayerOpen: boolean;
  /** False when the note has no stored audio: no play button is offered. */
  canPlay: boolean;
  /** The take's length, e.g. "0:12", shown above the row. */
  durationLabel: string;
  onTogglePlay(): void;
  onOpen(): void;
  onDelete(): void;
}

export function NoteCardActions({
  isPlayerOpen,
  canPlay,
  durationLabel,
  onTogglePlay,
  onOpen,
  onDelete
}: NoteCardActionsProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View testID='note-card-actions'>
      <Text style={[styles.duration, { color: colors.gray300 }]}>
        {durationLabel}
      </Text>

      <View style={styles.actions}>
        {canPlay ? (
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={
              isPlayerOpen ? t('notes.closePlayer') : t('notes.playNote')
            }
            onPress={onTogglePlay}
            style={[
              styles.actionButton,
              {
                backgroundColor: isPlayerOpen
                  ? colors.neutral300
                  : colors.primary500
              }
            ]}>
            <Text
              style={[
                styles.actionLabel,
                { color: isPlayerOpen ? colors.typography : colors.white }
              ]}>
              {isPlayerOpen ? t('common.close') : t('common.play')}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole='button'
          accessibilityLabel={t('notes.openAnalysis')}
          onPress={onOpen}
          style={[styles.actionButton, { backgroundColor: colors.neutral300 }]}>
          <Text style={[styles.actionLabel, { color: colors.typography }]}>
            {t('notes.analysis')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole='button'
          accessibilityLabel={t('notes.deleteNote')}
          onPress={onDelete}
          style={[styles.actionButton, styles.deleteButton]}>
          <Text style={[styles.actionLabel, { color: colors.error }]}>
            {t('common.delete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default NoteCardActions;

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  // Left-aligned so it reads as belonging to Play, the row's first button.
  duration: {
    fontSize: 12,
    fontWeight: '500'
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Tertiary, destructive: pushed to the end with no fill so it doesn't read as
  // a peer of the primary Play / Analysis actions.
  deleteButton: {
    marginLeft: 'auto',
    backgroundColor: 'transparent'
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600'
  }
});
