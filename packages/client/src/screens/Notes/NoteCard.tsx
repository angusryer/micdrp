/**
 * NoteCard — a single row in the Notes list.
 *
 * Reframed from the old Library card: a note is a musical-idea memo, not a graded
 * take, so there is no score badge. Instead the row surfaces the descriptive
 * analysis a singer cares about — detected key and vocal range — plus inline
 * playback. Tapping the body opens the note's detail/analysis; Delete is
 * delegated to the parent.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { MelodyView } from '../../components/MelodyView';
import { midiToLabel } from '../Results/NoteList';
import type { NoteMeta } from '../../data/notesCache';
import { PlaybackBar } from './PlaybackBar';

/** Horizontal space consumed by the list padding (16) + card padding (14) each side. */
const CARD_HORIZONTAL_INSET = 2 * (16 + 14);

export interface NoteCardProps {
  note: NoteMeta;
  /** Open the note's detail/analysis. */
  onOpen(id: string): void;
  onDelete(id: string): void;
}

/** Format ms duration as M:SS. */
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Format a ms epoch timestamp as a short date. */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function NoteCard({ note, onOpen, onDelete }: NoteCardProps) {
  const { colors, dimensions } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  const handleTogglePlay = useCallback((): void => setExpanded((v) => !v), []);
  const handleOpen = useCallback((): void => onOpen(note.id), [onOpen, note.id]);
  const handleDelete = useCallback(
    (): void => onDelete(note.id),
    [onDelete, note.id]
  );

  const range =
    note.rangeLowMidi != null && note.rangeHighMidi != null
      ? `${midiToLabel(note.rangeLowMidi)}–${midiToLabel(note.rangeHighMidi)}`
      : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.neutral100,
          borderColor: colors.neutral500,
          borderRadius: dimensions.radii[10]
        }
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notes.openNote', { title: note.title })}
        onPress={handleOpen}
      >
        <Text
          style={[styles.title, { color: colors.typography }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {note.title}
        </Text>

        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.gray300 }]}>
            {formatDate(note.createdAtMs)}
          </Text>
          <Text style={[styles.metaDot, { color: colors.gray100 }]}>{' · '}</Text>
          <Text style={[styles.metaText, { color: colors.gray300 }]}>
            {formatDuration(note.durationMs)}
          </Text>
          {note.key != null ? (
            <>
              <Text style={[styles.metaDot, { color: colors.gray100 }]}>
                {' · '}
              </Text>
              <Text style={[styles.metaText, { color: colors.gray300 }]}>
                {note.key}
              </Text>
            </>
          ) : null}
          {range != null ? (
            <>
              <Text style={[styles.metaDot, { color: colors.gray100 }]}>
                {' · '}
              </Text>
              <Text style={[styles.metaText, { color: colors.gray300 }]}>
                {range}
              </Text>
            </>
          ) : null}
        </View>

        {note.melody.length > 0 ? (
          <View style={styles.melodyWrap}>
            <MelodyView
              notes={note.melody}
              width={width - CARD_HORIZONTAL_INSET}
              height={48}
            />
          </View>
        ) : null}
      </Pressable>

      {expanded && note.audioUri ? (
        <View style={styles.playbackWrap}>
          <PlaybackBar
            audioUri={note.audioUri}
            durationLabel={formatDuration(note.durationMs)}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? t('notes.closePlayer') : t('notes.playNote')
          }
          onPress={handleTogglePlay}
          style={[
            styles.actionButton,
            { backgroundColor: expanded ? colors.neutral300 : colors.primary500 }
          ]}
        >
          <Text
            style={[
              styles.actionLabel,
              { color: expanded ? colors.typography : colors.white }
            ]}
          >
            {expanded ? t('common.close') : t('common.play')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notes.openAnalysis')}
          onPress={handleOpen}
          style={[styles.actionButton, { backgroundColor: colors.neutral300 }]}
        >
          <Text style={[styles.actionLabel, { color: colors.typography }]}>
            {t('notes.analysis')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notes.deleteNote')}
          onPress={handleDelete}
          style={[styles.actionButton, styles.deleteButton]}
        >
          <Text style={[styles.actionLabel, { color: colors.error }]}>
            {t('common.delete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default NoteCard;

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8
  },
  title: {
    fontSize: 15,
    fontWeight: '600'
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4
  },
  metaText: { fontSize: 12 },
  metaDot: { fontSize: 12 },
  melodyWrap: { marginTop: 10 },
  playbackWrap: { paddingVertical: 4 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
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
