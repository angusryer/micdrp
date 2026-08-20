/**
 * NoteCard — a single row in the Notes list.
 *
 * The card frame and what it composes: NoteCardMeta for the title and the
 * descriptive line, an optional melody shape, the playback bar, and
 * NoteCardActions for the take's length and the button row. Tapping the body
 * opens the note's detail/analysis; Delete is delegated to the parent.
 *
 * Pressing Play opens the playback bar already playing (INT-NOTES-010) — one
 * press to hear the take, not two.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { MelodyView } from '../../components/MelodyView';
import type { NoteMeta } from '../../data/notesCache';
import { PlaybackBar } from './PlaybackBar';
import { NoteCardActions } from './NoteCardActions';
import { NoteCardMeta } from './NoteCardMeta';
import { formatDuration } from './noteCardFormat';
import { notesRepo } from '../../data/notesRepo';

/** Horizontal space consumed by the list padding (16) + card padding (14) each side. */
const CARD_HORIZONTAL_INSET = 2 * (16 + 14);

export interface NoteCardProps {
  note: NoteMeta;
  /** Open the note's detail/analysis. */
  onOpen(id: string): void;
  onDelete(id: string): void;
}

export function NoteCard({ note, onOpen, onDelete }: NoteCardProps) {
  const { colors, dimensions } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  // Mint the audio URL when Play is pressed rather than here: the token it
  // carries is good for about two minutes (INV-NOTES-014).
  const resolveAudio = useCallback(
    () => notesRepo.audioUrlFor(note.id, note.audioPath),
    [note.id, note.audioPath]
  );

  // Press play → the bar mounts already playing. Press again → it unmounts,
  // and its cleanup stops the audio.
  const handleTogglePlay = useCallback((): void => setExpanded((v) => !v), []);
  const handleOpen = useCallback(
    (): void => onOpen(note.id),
    [onOpen, note.id]
  );
  const handleDelete = useCallback(
    (): void => onDelete(note.id),
    [onDelete, note.id]
  );

  const canPlay = note.audioPath != null;

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

      {expanded && canPlay ? (
        <View style={styles.playbackWrap}>
          {/* No durationLabel: the length is shown once, above the play button. */}
          <PlaybackBar resolveAudioUri={resolveAudio} shouldAutoPlay />
        </View>
      ) : null}

      <NoteCardActions
        isPlayerOpen={expanded}
        canPlay={canPlay}
        durationLabel={formatDuration(note.durationMs)}
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
  melodyWrap: { marginTop: 10 },
  playbackWrap: { paddingVertical: 4 }
});
