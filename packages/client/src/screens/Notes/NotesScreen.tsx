/**
 * NotesScreen — every sung idea kept, newest first (VIEW-NOTES-001).
 *
 * The whole page, because this is what the app opens on. A recorder used to
 * sit above the list, which cost the list its top third and gave the recorder
 * a strip: no room to draw what was being heard, and nowhere for the things a
 * singer does with their hands. Recording is its own view now.
 *
 * The record control floats over the list rather than sitting in it, so it is
 * in the same place whatever has been scrolled to — and the list ends with
 * room for it, so reaching the last card reaches the card and not the button
 * covering it.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import type {
  MainTabParamList,
  RootStackParamList
} from '../../navigation/types';
import type { NoteMeta } from '../../data/notesCache';
import { NoteCard } from './NoteCard';
import { NoteMixPlayer } from './NoteMixPlayer';
import { RecordButton, RECORD_BUTTON_CLEARANCE } from './RecordButton';
import { useNotes } from './useNotes';

export type NotesScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Notes'>,
  NativeStackScreenProps<RootStackParamList>
>;

type NotesNavigation = NotesScreenProps['navigation'];

export function NotesScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NotesNavigation>();

  const { notes, loading, offline, pending, refresh, remove } = useNotes();

  // Re-pulled whenever this page comes back into view. A note sung on the
  // recording view is written after this list was built, and a list that does
  // not show the take just sung reads as one that lost it.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const openNote = useCallback(
    (id: string): void => navigation.navigate('NoteDetail', { id }),
    [navigation]
  );

  // Deleting a note destroys real captured audio with no undo, so confirm first
  // (mirrors the account-deletion guard in AccountScreen).
  const handleRemove = useCallback(
    (id: string): void => {
      const note = notes.find((n) => n.id === id);
      Alert.alert(
        t('notes.delete.confirmTitle'),
        t('notes.delete.confirmBody', { title: note?.title ?? '' }),
        [
          { text: t('notes.delete.cancel'), style: 'cancel' },
          {
            text: t('notes.delete.confirm'),
            style: 'destructive',
            onPress: () => void remove(id)
          }
        ]
      );
    },
    [notes, remove, t]
  );

  // One note sounds at a time, and it sounds the mix that note was balanced
  // to. Held here rather than in the cards because reading a take to sound it
  // costs about a sixth of a second, which is affordable once on a press and
  // not once per row (INV-NOTES-124).
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingAtMs, setPlayingAtMs] = useState(0);
  const togglePlay = useCallback(
    (id: string) => {
      setPlayingAtMs(0);
      setPlayingId((was: string | null) => (was === id ? null : id));
    },
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: NoteMeta }) => (
      <NoteCard
        note={item}
        onOpen={openNote}
        onDelete={handleRemove}
        isPlaying={playingId === item.id}
        onTogglePlay={togglePlay}
        positionMs={playingId === item.id ? playingAtMs : 0}
      />
    ),
    [openNote, handleRemove, playingId, togglePlay, playingAtMs]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.primary500}
          />
        }
        ListHeaderComponent={
          offline ? (
            <Text style={[styles.offline, { color: colors.caution }]}>
              {t('notes.offline')}
            </Text>
          ) : pending > 0 ? (
            <Text style={[styles.offline, { color: colors.gray300 }]}>
              {t('notes.pending', { count: pending })}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.typography }]}>
                {/* Empty means empty. It used to mean this OR "could not
                    ask", and it said this while meaning that
                    (INV-NOTES-139). */}
                {offline ? t('notes.unreachableTitle') : t('notes.emptyTitle')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.gray300 }]}>
                {offline
                  ? t('notes.unreachableSubtitle')
                  : t('notes.emptySubtitle')}
              </Text>
            </View>
          )
        }
      />
      {/* Over the list, so it is in the same place whatever has been
          scrolled to. It opens the recording view rather than starting a
          capture where it stands (VIEW-NOTES-010). */}
      <RecordButton onPress={() => navigation.navigate('Record')} />

      {/* Draws nothing. Mounted for whichever note is sounding and no other,
          and unmounting it is how the sound stops (INV-NOTES-124). */}
      {playingId != null ? (
        <NoteMixPlayer
          key={playingId}
          noteId={playingId}
          onEnded={() => setPlayingId(null)}
          onPosition={setPlayingAtMs}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Room at the end for the control floating over it: scrolling to the last
  // card should reach the card, not the button covering it.
  list: { padding: 16, gap: 12, paddingBottom: RECORD_BUTTON_CLEARANCE },
  offline: { fontSize: 13, textAlign: 'center', paddingBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 }
});

export default NotesScreen;
