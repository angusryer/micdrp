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
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { PitchLine } from '../capture/PitchLine';
import { NoteRibbon } from '../capture/NoteRibbon';
import { TransportBar } from '../capture/TransportBar';
import type { NoteMeta } from '../../data/notesCache';
import { NoteCard } from './NoteCard';
import { useNoteCapture } from './useNoteCapture';
import { useNotes } from './useNotes';

export type NotesScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Notes'>,
  NativeStackScreenProps<RootStackParamList>
>;

type NotesNavigation = NotesScreenProps['navigation'];

const PITCH_LINE_HEIGHT = 132;
const PITCH_LINE_MARGIN = 16;

export function NotesScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
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

  const handleRemove = useCallback(
    (id: string): void => {
      void remove(id);
    },
    [remove]
  );

  const renderItem = useCallback(
    ({ item }: { item: NoteMeta }) => (
      <NoteCard note={item} onOpen={openNote} onDelete={handleRemove} />
    ),
    [openNote, handleRemove]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      {/* Capture section */}
      <View style={styles.capture}>
        <View style={styles.captureHeader}>
          <Text style={[styles.title, { color: colors.typography }]}>
            {isRecording ? t('notes.recording') : t('notes.capture')}
          </Text>
          {saveStatus === 'saving' ? (
            <ActivityIndicator size="small" color={colors.primary500} />
          ) : null}
        </View>

        <NoteRibbon sharedMidi={sharedMidi} sharedCents={sharedCents} />

        <View
          style={[
            styles.pitchWrap,
            { backgroundColor: colors.neutral50, borderColor: colors.neutral500 }
          ]}
        >
          <PitchLine
            sharedMidi={sharedMidi}
            sharedFrame={sharedFrame}
            width={width - 2 * PITCH_LINE_MARGIN}
            height={PITCH_LINE_HEIGHT}
          />
        </View>

        <TransportBar state={state} onStart={start} onStop={handleStop} />

        {saveStatus === 'error' ? (
          <Text style={[styles.error, { color: colors.error }]}>
            {t('notes.saveError')}
          </Text>
        ) : null}
      </View>

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
  capture: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8
  },
  captureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  title: { fontSize: 18, fontWeight: '700' },
  pitchWrap: {
    marginHorizontal: PITCH_LINE_MARGIN,
    height: PITCH_LINE_HEIGHT,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  error: { textAlign: 'center', fontSize: 13 },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 }
});

export default NotesScreen;
