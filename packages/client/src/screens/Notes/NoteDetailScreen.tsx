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
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { notesToMidi, quantize, type NoteEvent } from 'logic';

import { ChordTrack } from './ChordTrack';
import { useChordTrack } from './useChordTrack';

import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { createReferenceTonePlayer } from '../../audio/referenceTone';
import { cachedNotes } from '../../data/notesSync';
import { notesRepo } from '../../data/notesRepo';
import { writeMidi } from '../../data/files';
import { MelodyView } from '../../components/MelodyView';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteList, midiToLabel } from '../Results/NoteList';
import { PlaybackBar } from './PlaybackBar';

/** Side padding of the detail scroll content (keep in sync with styles.content). */
const CONTENT_PADDING = 20;
/** Height of the piano-roll melody view. */
const MELODY_VIEW_HEIGHT = 150;

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
  const { width } = useWindowDimensions();
  const { id } = route.params;

  const note = useMemo(() => cachedNotes().find((n) => n.id === id), [id]);
  const melody = (note?.melody ?? []) as NoteEvent[];

  // Mint the audio URL when Play is pressed rather than here: the token it
  // carries is good for about two minutes (INV-NOTES-014).
  const audioPath = note?.audioPath ?? null;
  const resolveAudio = useCallback(
    () => notesRepo.audioUrlFor(id, audioPath),
    [id, audioPath]
  );

  // Fit the metrical grid here rather than reading a stored one. The melody is
  // persisted, so this costs nothing and needs no migration — and it means
  // notes captured before the tempo estimator was fixed are re-read correctly
  // instead of keeping a bpm that was often double what was actually sung.
  const quantized = useMemo(() => quantize(melody), [melody]);
  const grid = quantized.grid;
  const hasGrid = grid.bpm > 0 && melody.length > 1;
  const meterIsStated = grid.meterIsStated;
  const gridForView = useMemo(
    () =>
      hasGrid
        ? {
            bpm: grid.bpm,
            offsetMs: grid.offsetMs,
            beatsPerBar: grid.beatsPerBar
          }
        : undefined,
    [hasGrid, grid.bpm, grid.offsetMs, grid.beatsPerBar]
  );

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

  // The editable harmonic backdrop, derived from the same fitted grid the bar
  // lines are drawn from, so chords and bars always agree.
  const chords = useChordTrack(melody, grid);
  // Tap a note to hear its pitch.
  const tonePlayer = useMemo(() => createReferenceTonePlayer(), []);
  useEffect(() => () => tonePlayer.stop(), [tonePlayer]);
  const playNote = useCallback(
    (midi: number) => {
      tonePlayer.play([{ midi, startMs: 0, endMs: TAP_NOTE_MS }]);
    },
    [tonePlayer]
  );

  // A chord is just its notes sounded together, which the reference player
  // already supports: overlapping targets over the same span.
  const auditionChord = useCallback(
    (index: number) => {
      const midis = chords.voicing(index);
      if (midis.length === 0) {
        return;
      }
      tonePlayer.play(
        midis.map((midi) => ({ midi, startMs: 0, endMs: chords.auditionMs }))
      );
    },
    [tonePlayer, chords]
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
  const tempo = hasGrid ? `${grid.bpm} BPM` : '—';
  const meter = hasGrid ? grid.timeSignature : '—';

  const stats: Array<{ label: string; value: string }> = [
    { label: t('notes.stat.key'), value: note.key ?? '—' },
    { label: t('notes.stat.tempo'), value: tempo },
    { label: t('notes.stat.meter'), value: meter },
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

        {note.audioPath ? (
          <PlaybackBar
            resolveAudioUri={resolveAudio}
            durationLabel={formatDuration(note.durationMs)}
          />
        ) : null}

        {melody.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
              {t('notes.shape')}
            </Text>
            <View
              style={[
                styles.melodyCard,
                {
                  backgroundColor: colors.neutral50,
                  borderColor: colors.neutral500
                }
              ]}
            >
              <MelodyView
                notes={melody}
                width={width - 2 * CONTENT_PADDING - 2}
                height={MELODY_VIEW_HEIGHT}
                grid={gridForView}
              />
            </View>
            {/* Say when the bar lines are an assumption rather than a reading.
                A short sung idea often does not state its metre, and drawing
                confident bar lines over one would be inventing information. */}
            {hasGrid && !meterIsStated ? (
              <Text style={[styles.caption, { color: colors.gray300 }]}>
                {t('notes.gridAssumed')}
              </Text>
            ) : null}
            {!hasGrid ? (
              <Text style={[styles.caption, { color: colors.gray300 }]}>
                {t('notes.gridNone')}
              </Text>
            ) : null}
          </>
        ) : null}

        {melody.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
              {t('notes.harmony')}
            </Text>
            {chords.slots.length > 0 ? (
              <>
                <ChordTrack
                  slots={chords.slots}
                  onNudge={chords.nudge}
                  onReshape={chords.reshape}
                  onAudition={auditionChord}
                  onRevert={chords.revert}
                />
                <Text style={[styles.caption, { color: colors.gray300 }]}>
                  {t('notes.harmonyHint')}
                </Text>
                {chords.hasEdits ? (
                  <Text
                    accessibilityRole="button"
                    onPress={chords.revertAll}
                    style={[styles.action, { color: colors.primary500 }]}
                  >
                    {t('notes.harmonyReset')}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.caption, { color: colors.gray300 }]}>
                {t('notes.harmonyNone')}
              </Text>
            )}
          </>
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
  melodyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8
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
  caption: { fontSize: 12, lineHeight: 17 },
  action: { fontSize: 13, fontWeight: '700' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 16, fontWeight: '700' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
