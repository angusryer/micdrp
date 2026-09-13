/**
 * NoteCardActions — the button row under a note card.
 *
 * Play is the singer's press to hear the take, and it is the only playback
 * control the card has: the press starts the audio and moves this same button
 * into its playing state, from which it stops the take (INT-NOTES-010,
 * INV-NOTES-015). It never becomes a Close, because nothing was opened. A note
 * whose audio was never stored gets no play button at all.
 *
 * The take's clock sits on its own line directly above the row, aligned with
 * Play — the space the close control used to occupy. Before the press it is the
 * take's length, the fact a singer wants as they decide whether to play; while
 * the take runs it counts the position against that length (INV-NOTES-016).
 */
import { Icon } from '../../components/Icon';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type { PlaybackState } from './usePlayback';

export interface NoteCardActionsProps {
  /** Where the take is: the button reads and behaves as this state. */
  playbackState: PlaybackState;
  /** False when the note has no stored audio: no play button is offered. */
  canPlay: boolean;
  /** The take's clock: "0:12" at rest, "0:03 / 0:12" while it plays. */
  timeLabel: string;
  onTogglePlay(): void;
  onOpen(): void;
  onDelete(): void;
  /** True while this take is kept to hand (INV-NOTES-271). */
  isFavourite?: boolean;
  onToggleFavourite?(): void;
}

export function NoteCardActions({
  playbackState,
  canPlay,
  timeLabel,
  onTogglePlay,
  onOpen,
  onDelete,
  isFavourite = false,
  onToggleFavourite
}: NoteCardActionsProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';

  return (
    <View testID='note-card-actions'>
      <Text
        testID='note-card-time'
        style={[styles.time, { color: colors.gray300 }]}>
        {timeLabel}
      </Text>

      <View style={styles.actions}>
        {/* First, because keeping a take to hand is a thing said about the
            take rather than a thing done to it (INV-NOTES-271). */}
        {onToggleFavourite != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isFavourite ? 'Stop keeping this take to hand' : 'Keep this take to hand'
            }
            accessibilityState={{ selected: isFavourite }}
            testID="note-card-favourite"
            hitSlop={8}
            onPress={onToggleFavourite}
            style={({ pressed }) => [styles.star, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Icon
              name={isFavourite ? 'star' : 'starOff'}
              size={20}
              color={isFavourite ? colors.gold : colors.gray300}
            />
          </Pressable>
        ) : null}
        {canPlay ? (
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={
              isPlaying ? t('notes.stopNote') : t('notes.playNote')
            }
            accessibilityState={{ selected: isPlaying, busy: isLoading }}
            onPress={onTogglePlay}
            style={[
              styles.actionButton,
              {
                backgroundColor: isPlaying
                  ? colors.primary300
                  : colors.primary500
              }
            ]}>
            <Text style={[styles.actionLabel, { color: colors.white }]}>
              {isPlaying ? t('common.stop') : t('common.play')}
            </Text>
          </Pressable>
        ) : null}

        {playbackState === 'error' ? (
          <Text style={[styles.playbackError, { color: colors.error }]}>
            {t('notes.playbackFailed')}
          </Text>
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
  star: { paddingHorizontal: 6, paddingVertical: 4 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  // Left-aligned so it reads as belonging to Play, the row's first button.
  // Tabular figures keep the counter from shifting the line as it ticks.
  time: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums']
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
  },
  playbackError: {
    fontSize: 12
  }
});
