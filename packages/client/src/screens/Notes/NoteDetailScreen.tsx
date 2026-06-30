/**
 * NoteDetailScreen — a single note's reframed analysis.
 *
 * A note is a musical-idea memo, so this is *analysis*, not a grade: detected
 * key, natural tempo, vocal range and intonation steadiness — plus the note list
 * (tap to hear each pitch) and a MIDI export. The symbolic melody is read
 * straight from the cache; the audio is never re-touched. MIDI is generated
 * on-the-fly from the stored melody so export works without a server round-trip.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { notesToMidi, type NoteEvent } from 'logic';

import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { createReferenceTonePlayer } from '../../audio/referenceTone';
import { cachedNotes } from '../../data/notesSync';
import { writeMidi } from '../../data/files';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteList, midiToLabel } from '../Results/NoteList';
import { PlaybackBar } from './PlaybackBar';

/** How long a tapped reference note sounds, in ms. */
const TAP_NOTE_MS = 700;

type Props = NativeStackScreenProps<RootStackParamList, 'NoteDetail'>;

/** Format ms duration as M:SS. */
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function NoteDetailScreen({ route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { id } = route.params;

  const note = useMemo(() => cachedNotes().find((n) => n.id === id), [id]);
  const melody = (note?.melody ?? []) as NoteEvent[];

  // Generate + write the MIDI for export from the stored symbolic melody.
  const [midiUri, setMidiUri] = useState<string | null>(null);
  useEffect(() => {
    if (!note || melody.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const uri = await writeMidi(note.id, notesToMidi(melody));
        if (!cancelled) {
          setMidiUri(uri);
        }
      } catch {
        // Export simply stays unavailable if the write fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [note, melody]);

  // Tap a note to hear its pitch.
  const tonePlayer = useMemo(() => createReferenceTonePlayer(), []);
  useEffect(() => () => tonePlayer.stop(), [tonePlayer]);
  const playNote = useCallback(
    (midi: number) => {
      tonePlayer.play([{ midi, startMs: 0, endMs: TAP_NOTE_MS }]);
    },
    [tonePlayer]
  );

  if (!note) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.neutral300 }]}
      >
        <View style={styles.missing}>
          <Text style={{ color: colors.gray300 }}>{t('notes.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const range =
    note.rangeLowMidi != null && note.rangeHighMidi != null
      ? `${midiToLabel(note.rangeLowMidi)}–${midiToLabel(note.rangeHighMidi)}`
      : '—';
  const steadiness =
    note.inTuneRatio != null ? `${Math.round(note.inTuneRatio * 100)}%` : '—';
  const tempo = note.tempoBpm != null ? `${Math.round(note.tempoBpm)} BPM` : '—';

  const stats: Array<{ label: string; value: string }> = [
    { label: t('notes.stat.key'), value: note.key ?? '—' },
    { label: t('notes.stat.tempo'), value: tempo },
    { label: t('notes.stat.range'), value: range },
    { label: t('notes.stat.steadiness'), value: steadiness },
    { label: t('notes.stat.notes'), value: String(note.noteCount) },
    { label: t('notes.stat.length'), value: formatDuration(note.durationMs) }
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.neutral300 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.typography }]}>
          {note.title}
        </Text>

        {note.audioUri ? (
          <PlaybackBar
            audioUri={note.audioUri}
            durationLabel={formatDuration(note.durationMs)}
          />
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
          {t('notes.analysis')}
        </Text>
        <View style={styles.statGrid}>
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
              <Text style={[styles.statLabel, { color: colors.gray300 }]}>
                {s.label}
              </Text>
              <Text style={[styles.statValue, { color: colors.typography }]}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
          {t('notes.notesTapToHear')}
        </Text>
        <NoteList notes={melody} onPressNote={playNote} />

        <ExportSheet midiUri={midiUri} title={note.title} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 24, fontWeight: '700' },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  stat: {
    flexGrow: 1,
    flexBasis: '30%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 16, fontWeight: '700' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
