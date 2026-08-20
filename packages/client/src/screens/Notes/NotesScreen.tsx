/**
 * NotesScreen — the Notes tab: capture a sung idea, then browse the corpus.
 *
 * Collapses the old Record + Library surfaces into one. The top section is a
 * compact recorder (the same UI-thread shared-value pitch pipeline as Practice);
 * stopping analyses and saves the capture as a note with no score gate. Below is
 * the list of saved notes, newest first, each opening its detail/analysis.
 *
 * The per-audio-frame path never crosses React state — see useRecordController.
 */
import React, { useCallback } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { CaptureSection } from './CaptureSection';
import { NoteCard } from './NoteCard';
import { useNoteCapture } from './useNoteCapture';
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

  const { notes, loading, refresh, remove } = useNotes();
  const {
    sharedMidi,
    sharedCents,
    sharedFrame,
    state,
    isRecording,
    start,
    stopAndSave,
    saveStatus
  } = useNoteCapture(refresh);

  const handleStop = useCallback((): void => {
    void stopAndSave();
  }, [stopAndSave]);

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

  const renderItem = useCallback(
    ({ item }: { item: NoteMeta }) => (
      <NoteCard note={item} onOpen={openNote} onDelete={handleRemove} />
    ),
    [openNote, handleRemove]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <CaptureSection
        sharedMidi={sharedMidi}
        sharedCents={sharedCents}
        sharedFrame={sharedFrame}
        state={state}
        isRecording={isRecording}
        saveStatus={saveStatus}
        onStart={start}
        onStop={handleStop}
      />

      {/* Saved notes */}
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
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.typography }]}>
                {t('notes.emptyTitle')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.gray300 }]}>
                {t('notes.emptySubtitle')}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 }
});

export default NotesScreen;
