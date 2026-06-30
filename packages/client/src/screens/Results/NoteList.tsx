/**
 * Scrollable list of segmented notes for a finished take (WP-RESULTS-UI).
 *
 * Presentational only: it renders the `NoteEvent[]` produced by the offline
 * pipeline (smoothPitch → segmentNotes). Note names are derived from the MIDI
 * number using `logic`'s `NOTE_NAMES` table — no DSP or pitch math is duplicated
 * here. A `FlatList` keeps long takes cheap to scroll.
 */
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { NOTE_NAMES, type NoteEvent } from 'logic';

import { useTheme } from '../../theme';

export interface NoteListProps {
  notes: NoteEvent[];
}

/** Scientific-pitch label for a MIDI note number, e.g. 69 → "A4". */
export function midiToLabel(midi: number): string {
  const index = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[index]}${octave}`;
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export function NoteList({ notes }: NoteListProps) {
  const { colors } = useTheme();

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<NoteEvent>) => {
      const cents = Math.round(item.cents);
      const centsLabel = cents === 0 ? '±0' : cents > 0 ? `+${cents}` : `${cents}`;
      return (
        <View
          style={[styles.row, { borderBottomColor: colors.neutral500 }]}
          accessibilityRole="text"
          accessibilityLabel={`Note ${index + 1}: ${midiToLabel(item.midi)}, ${Math.round(
            item.durationMs
          )} milliseconds, ${centsLabel} cents`}
        >
          <Text style={[styles.name, { color: colors.typography }]}>
            {midiToLabel(item.midi)}
          </Text>
          <Text style={[styles.time, { color: colors.gray300 }]}>
            {formatTime(item.startMs)}
          </Text>
          <Text style={[styles.duration, { color: colors.gray500 }]}>
            {Math.round(item.durationMs)} ms
          </Text>
          <Text style={[styles.cents, { color: colors.gray300 }]}>{centsLabel}¢</Text>
        </View>
      );
    },
    [colors]
  );

  if (notes.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.gray300 }]}>
          No notes detected in this take.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notes}
      keyExtractor={(item, index) => `${index}:${item.startMs}:${item.midi}`}
      renderItem={renderItem}
      style={styles.list}
    />
  );
}

export default NoteList;

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  name: { flex: 2, fontSize: 16, fontWeight: '600' },
  time: { flex: 2, fontSize: 13, textAlign: 'right' },
  duration: { flex: 2, fontSize: 13, textAlign: 'right' },
  cents: { flex: 1, fontSize: 13, textAlign: 'right' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14 }
});
