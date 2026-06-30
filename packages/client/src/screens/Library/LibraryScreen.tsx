/**
 * LibraryScreen — history & playback (WP-LIBRARY-UI).
 *
 * A FlatList of {@link RecordingCard}s sourced from the persisted recordings
 * index via {@link useLibrary}. Shows an empty state when nothing has been
 * recorded yet, and supports pull-to-refresh.
 *
 * Typed as a bottom-tab screen: `BottomTabScreenProps<MainTabParamList, 'Library'>`.
 *
 * See docs/NATIVE_BUILD_PLAN.md §3 (WP-LIBRARY-UI).
 */
import React, { useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useTheme } from '../../theme';
import type { MainTabParamList } from '../../navigation/types';
import type { RecordingMeta } from '../../data/recordings';
import { RecordingCard } from './RecordingCard';
import { useLibrary } from './useLibrary';

export type LibraryScreenProps = BottomTabScreenProps<MainTabParamList, 'Library'>;

function EmptyState() {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <Text style={[styles.emptyIcon, { color: colors.neutral500 }]}>
        {'🎤'}
      </Text>
      <Text style={[styles.emptyTitle, { color: colors.typography }]}>
        No recordings yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.gray300 }]}>
        Head to the Record tab to capture your first take.
      </Text>
    </View>
  );
}

// Separator between cards
function Separator() {
  return <View style={styles.separator} />;
}

export function LibraryScreen(_props: LibraryScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const { recordings, loading, refresh, remove, shareMidi } = useLibrary();

  const renderItem = useCallback(
    ({ item }: { item: RecordingMeta }) => (
      <RecordingCard
        meta={item}
        onDelete={remove}
        onShareMidi={shareMidi}
      />
    ),
    [remove, shareMidi]
  );

  const keyExtractor = useCallback(
    (item: RecordingMeta) => item.id,
    []
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.neutral300 }]}
    >
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.typography }]}>
          Library
        </Text>
      </View>

      <FlatList
        data={recordings}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[
          styles.listContent,
          recordings.length === 0 && styles.listContentEmpty
        ]}
        ListEmptyComponent={loading ? null : EmptyState}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.primary500}
            colors={[colors.primary500]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

export default LibraryScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12
  },
  heading: {
    fontSize: 28,
    fontWeight: '700'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 0
  },
  listContentEmpty: {
    flex: 1
  },
  separator: {
    height: 10
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8
  },
  emptyIcon: {
    fontSize: 48
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  }
});
