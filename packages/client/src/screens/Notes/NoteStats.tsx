/**
 * NoteStats — what the take was, described. Never scored: a note is a musical
 * idea someone kept, and grading it is the one thing this screen must not do
 * (INV-NOTES-002).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';


import type { MusicalGrid } from 'logic';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { midiToLabel } from '../Results/NoteList';

/** Format ms duration as M:SS. */
export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Only what the description needs — the cache's row shape, not the full DTO. */
export interface NoteStatsSubject {
  key?: string | null;
  rangeLowMidi?: number | null;
  rangeHighMidi?: number | null;
  inTuneRatio?: number | null;
  noteCount: number;
  durationMs: number;
}

export interface NoteStatsProps {
  note: NoteStatsSubject;
  grid: MusicalGrid;
  hasGrid: boolean;
  /** How many chords the take was given, which is a fact about this take. */
  chordCount: number;
}

export function NoteStats({
  note,
  grid,
  hasGrid,
  chordCount
}: NoteStatsProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const range =
    note.rangeLowMidi != null && note.rangeHighMidi != null
      ? `${midiToLabel(note.rangeLowMidi)}–${midiToLabel(note.rangeHighMidi)}`
      : '—';
  const steadiness =
    note.inTuneRatio != null ? `${Math.round(note.inTuneRatio * 100)}%` : '—';

  const stats: Array<{ label: string; value: string }> = [
    { label: t('notes.stat.key'), value: note.key ?? '—' },
    { label: t('notes.stat.tempo'), value: hasGrid ? `${grid.bpm} BPM` : '—' },
    // Not the time signature. A hummed idea does not state one, and the app
    // saying "4/4" over a take nobody has arranged is a guess presented as a
    // reading (INV-NOTES-050). How many chords it was given is a fact.
    { label: t('notes.stat.chords'), value: chordCount > 0 ? String(chordCount) : '—' },
    { label: t('notes.stat.range'), value: range },
    { label: t('notes.stat.steadiness'), value: steadiness },
    { label: t('notes.stat.notes'), value: String(note.noteCount) },
    { label: t('notes.stat.length'), value: formatDuration(note.durationMs) }
  ];

  return (
    <View style={styles.grid}>
      {stats.map((s) => (
        <View
          key={s.label}
          style={[
            styles.stat,
            {
              backgroundColor: colors.neutral100,
              borderColor: colors.neutral500
            }
          ]}
        >
          <Text style={[styles.label, { color: colors.gray300 }]}>
            {s.label}
          </Text>
          <Text style={[styles.value, { color: colors.typography }]}>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default NoteStats;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 96
  },
  label: { fontSize: 11 },
  value: { fontSize: 16, fontWeight: '600', marginTop: 2 }
});
