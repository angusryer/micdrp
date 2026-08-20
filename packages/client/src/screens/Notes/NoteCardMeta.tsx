/**
 * NoteCardMeta — a note card's title and its descriptive line.
 *
 * A note is a musical-idea memo, not a graded take, so the line carries what a
 * singer actually wants at a glance — when it was captured, the detected key,
 * the vocal range — and never a score. The take's length is not here: it sits
 * with the play control instead, where it is about to matter.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { midiToLabel } from '../Results/NoteList';
import type { NoteMeta } from '../../data/notesCache';
import { formatDate } from './noteCardFormat';

export interface NoteCardMetaProps {
  note: NoteMeta;
}

export function NoteCardMeta({ note }: NoteCardMetaProps) {
  const { colors } = useTheme();

  const range =
    note.rangeLowMidi != null && note.rangeHighMidi != null
      ? `${midiToLabel(note.rangeLowMidi)}–${midiToLabel(note.rangeHighMidi)}`
      : null;

  const facts = [formatDate(note.createdAtMs), note.key, range].filter(
    (f): f is string => f != null
  );

  return (
    <>
      <Text
        style={[styles.title, { color: colors.typography }]}
        numberOfLines={1}
        ellipsizeMode='tail'>
        {note.title}
      </Text>

      <View style={styles.meta}>
        {facts.map((fact, i) => (
          <React.Fragment key={`${i}:${fact}`}>
            {i > 0 ? (
              <Text style={[styles.metaDot, { color: colors.gray100 }]}>
                {' · '}
              </Text>
            ) : null}
            <Text style={[styles.metaText, { color: colors.gray300 }]}>
              {fact}
            </Text>
          </React.Fragment>
        ))}
      </View>
    </>
  );
}

export default NoteCardMeta;

const styles = StyleSheet.create({
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
  metaDot: { fontSize: 12 }
});
