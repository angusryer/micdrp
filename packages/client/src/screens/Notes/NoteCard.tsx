/**
 * NoteCard — a single row in the Notes list.
 *
 * The card frame and what it composes: NoteCardMeta for the title and the
 * descriptive line, an optional melody shape, and NoteCardActions for the
 * take's clock and the button row. Tapping the body opens the note's
 * detail/analysis; Delete is delegated to the parent.
 *
 * The card plays the take itself rather than disclosing a player to play it:
 * pressing Play starts the audio and turns that button into Stop
 * (INT-NOTES-010, INV-NOTES-015). One press to hear the take, and no Close to
 * dismiss a bar the singer never asked to open. The line the Close vacated
 * carries the take's clock, counting the position while it runs
 * (INV-NOTES-016).
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { hasTakeAudio } from '../../data/takeAudio';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { MelodyView } from '../../components/MelodyView';
import type { NoteMeta } from '../../data/notesCache';
import { useListening } from './useListening';
import type { PlaybackState } from './usePlayback';
import { NoteCardActions } from './NoteCardActions';
import { NoteCardMeta } from './NoteCardMeta';
import { formatPlaybackCounter } from './noteCardFormat';

/** Horizontal space consumed by the list padding (16) + card padding (14) each side. */
const CARD_HORIZONTAL_INSET = 2 * (16 + 14);

export interface NoteCardProps {
  note: NoteMeta;
  /** Open the note's detail/analysis. */
  onOpen(id: string): void;
  onDelete(id: string): void;
  /** True while this note is the one sounding (INV-NOTES-124). */
  isPlaying: boolean;
  /** Ask for this note to sound, or to stop if it already is. */
  onTogglePlay(id: string): void;
  /** How far the sound has got, when this is the note making it. */
  positionMs?: number;
}

export function NoteCard({
  note,
  onOpen,
  onDelete,
  isPlaying,
  onTogglePlay,
  positionMs = 0
}: NoteCardProps) {
  const { colors, dimensions } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  // The card asks for the sound rather than making it. One note sounds at a
  // time, and it sounds the whole mix that note was balanced to — which needs
  // the note read, and reading it once per row would not be affordable
  // (INV-NOTES-124).
  const listening = useListening(note.id);
  const isTakeAudible = listening.mix.take;
  const state: PlaybackState = isPlaying ? 'playing' : 'stopped';

  // Press play → the take starts and the button reads Stop. Press again → the
  // audio stops and it reads Play. There is no third thing to press.
  const handleTogglePlay = useCallback((): void => {
    onTogglePlay(note.id);
  }, [onTogglePlay, note.id]);
  const handleOpen = useCallback(
    (): void => onOpen(note.id),
    [onOpen, note.id]
  );
  const handleDelete = useCallback(
    (): void => onDelete(note.id),
    [onDelete, note.id]
  );

  // A take silenced in the note is not offered here either. A play button
  // that produces nothing is worse than one that is plainly unavailable
  // (INV-NOTES-124).
  // Any copy of the recording, not the uploaded one alone: a take is on the
  // device before it is on the server, and may never reach it (INV-NOTES-186).
  const canPlay = hasTakeAudio(note) && isTakeAudible;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.neutral100,
          borderColor: colors.neutral500,
          borderRadius: dimensions.radii[10]
        }
      ]}>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel={t('notes.openNote', { title: note.title })}
        onPress={handleOpen}>
        <NoteCardMeta note={note} />

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

      <NoteCardActions
        playbackState={state}
        canPlay={canPlay}
        timeLabel={formatPlaybackCounter(
          note.durationMs,
          state === 'playing' ? positionMs : null
        )}
        onTogglePlay={handleTogglePlay}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
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
  melodyWrap: { marginTop: 10 }
});
