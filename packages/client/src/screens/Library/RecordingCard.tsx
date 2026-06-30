/**
 * RecordingCard — a single row in the Library FlatList (WP-LIBRARY-UI).
 *
 * Renders: title, formatted date, duration, an optional score badge, and
 * action buttons: Play (opens a PlaybackBar inline) and Delete.
 *
 * Keeps local state only for the expanded playback row; heavy audio state
 * lives in PlaybackBar. Deletion is delegated to the parent via `onDelete`.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-LIBRARY-UI).
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { useTheme } from '../../theme';
import type { RecordingMeta } from '../../data/recordings';
import { PlaybackBar } from './PlaybackBar';

export interface RecordingCardProps {
  meta: RecordingMeta;
  onDelete(id: string): void;
  /** Optional: called when the user taps the MIDI export button. */
  onShareMidi?(meta: RecordingMeta): void;
}

/** Format ms duration as M:SS */
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Format a ms epoch timestamp as a short date (e.g. "Jun 30, 2026 14:05"). */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function RecordingCard({
  meta,
  onDelete,
  onShareMidi
}: RecordingCardProps) {
  const { colors, dimensions } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handleTogglePlay = useCallback((): void => {
    setExpanded((v) => !v);
  }, []);

  const handleDelete = useCallback((): void => {
    onDelete(meta.id);
  }, [onDelete, meta.id]);

  const handleShare = useCallback((): void => {
    onShareMidi?.(meta);
  }, [onShareMidi, meta]);

  const scoreColor =
    meta.score == null
      ? colors.gray100
      : meta.score >= 80
      ? colors.primary300
      : meta.score >= 50
      ? colors.gold
      : colors.error;

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
      {/* Top row: title + score badge */}
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.typography }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {meta.title}
        </Text>
        {meta.score != null ? (
          <View style={[styles.badge, { backgroundColor: scoreColor }]}>
            <Text style={[styles.badgeText, { color: colors.white }]}>
              {Math.round(meta.score)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Metadata row */}
      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: colors.gray300 }]}>
          {formatDate(meta.createdAtMs)}
        </Text>
        <Text style={[styles.metaDot, { color: colors.gray100 }]}>{' · '}</Text>
        <Text style={[styles.metaText, { color: colors.gray300 }]}>
          {formatDuration(meta.durationMs)}
        </Text>
        {meta.noteCount != null ? (
          <>
            <Text style={[styles.metaDot, { color: colors.gray100 }]}>{' · '}</Text>
            <Text style={[styles.metaText, { color: colors.gray300 }]}>
              {meta.noteCount} {meta.noteCount === 1 ? 'note' : 'notes'}
            </Text>
          </>
        ) : null}
      </View>

      {/* Inline playback bar when expanded */}
      {expanded ? (
        <View style={styles.playbackWrap}>
          <PlaybackBar
            audioUri={meta.audioUri}
            durationLabel={formatDuration(meta.durationMs)}
          />
        </View>
      ) : null}

      {/* Action row */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Close player' : 'Play recording'}
          onPress={handleTogglePlay}
          style={[
            styles.actionButton,
            {
              backgroundColor: expanded ? colors.neutral300 : colors.primary500
            }
          ]}
        >
          <Text
            style={[
              styles.actionLabel,
              { color: expanded ? colors.typography : colors.white }
            ]}
          >
            {expanded ? 'Close' : 'Play'}
          </Text>
        </Pressable>

        {meta.midiUri != null && onShareMidi != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export MIDI"
            onPress={handleShare}
            style={[
              styles.actionButton,
              { backgroundColor: colors.neutral300 }
            ]}
          >
            <Text style={[styles.actionLabel, { color: colors.typography }]}>
              Export
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete recording"
          onPress={handleDelete}
          style={[
            styles.actionButton,
            { backgroundColor: colors.neutral300 }
          ]}
        >
          <Text style={[styles.actionLabel, { color: colors.error }]}>
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default RecordingCard;

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600'
  },
  badge: {
    minWidth: 36,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  metaText: {
    fontSize: 12
  },
  metaDot: {
    fontSize: 12
  },
  playbackWrap: {
    paddingVertical: 4
  },
  actions: {
    flexDirection: 'row',
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
  actionLabel: {
    fontSize: 13,
    fontWeight: '600'
  }
});
