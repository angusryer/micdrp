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
import { QueueRow } from './QueueRow';
import { useFeedbackQueue } from './useFeedbackQueue';

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
      renderItem={({ item }) => <QueueRow clip={item} onRemoved={refresh} />}
    />
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  error: { fontSize: 13, marginBottom: 8 }
});

export default FeedbackQueueScreen;
