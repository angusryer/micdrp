/**
 * What the loop is doing with the feedback already sent.
 *
 * It runs on a machine elsewhere, so a clip that has been picked up looks
 * exactly like one that is stuck. This is the answer to "is it working?"
 * without going to read a log.
 */
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { useTheme } from '../theme';
import { useFeedbackQueue } from './useFeedbackQueue';
import type { QueuedClip } from './queue';

export function FeedbackQueueScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { clips, isLoading, error, refresh } = useFeedbackQueue();

  if (isLoading && clips.length === 0) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.neutral300 }]}>
        <ActivityIndicator color={colors.primary500} />
      </View>
    );
  }

  return (
    <FlatList
      testID="feedback-queue"
      style={{ backgroundColor: colors.neutral300 }}
      contentContainerStyle={styles.list}
      data={clips}
      keyExtractor={(clip) => clip.id}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary500} />
      }
      ListHeaderComponent={
        error != null ? (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        ) : null
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.gray500 }]}>
          Nothing sent yet. Record a remark from any screen.
        </Text>
      }
      renderItem={({ item }) => <QueueRow clip={item} />}
    />
  );
}

function QueueRow({ clip }: { clip: QueuedClip }): React.JSX.Element {
  const { colors } = useTheme();
  const percent = clip.progress?.percent ?? 0;
  const isDone = clip.state === 'delivered' || percent >= 100;

  return (
    <View style={[styles.row, { backgroundColor: colors.neutral100 }]}>
      <Text numberOfLines={2} style={[styles.label, { color: colors.typography }]}>
        {clip.label ?? `Recorded ${new Date(clip.recordedAtMs).toLocaleTimeString()}`}
      </Text>

      <View style={[styles.track, { backgroundColor: colors.neutral500 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(2, percent)}%`,
              // Stalled reads differently from failed: it may yet finish, but
              // it has not said anything for a long time.
              backgroundColor: clip.isStalled
                ? colors.error
                : isDone
                  ? colors.primary300
                  : colors.primary500
            }
          ]}
        />
      </View>

      <Text style={[styles.note, { color: colors.gray500 }]}>
        {clip.isStalled
          ? `${percent}% · silent for a while`
          : `${percent}% · ${clip.progress?.note ?? clip.state}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  row: { borderRadius: 12, padding: 14, gap: 8 },
  label: { fontSize: 15, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  note: { fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  error: { fontSize: 13, marginBottom: 8 }
});

export default FeedbackQueueScreen;
