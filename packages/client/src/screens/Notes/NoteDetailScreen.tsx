/**
 * NoteDetailScreen — a single note's reframed analysis.
 *
 * A note is a musical-idea memo, so this is *analysis*, not a grade: detected
 * key, natural tempo, vocal range and intonation steadiness — plus the note list
 * (tap to hear each pitch) and a MIDI export. Play sounds the take and the chord
 * backdrop together, so the singer hears the harmony their line implied rather
 * than the bare recording — or whichever tracks are left on beside the play
 * control, the melody read from the take among them. The graph and the list draw the take either as it
 * was sung or as it was written down, whichever the choice above the graph is
 * set to. The melody read from the take has its own control under the graph,
 * which starts it and stops it again (INV-NOTES-031). The symbolic melody is
 * read straight from the cache;
 * the audio is never re-touched. MIDI is generated on-the-fly from the stored
 * melody so export works without a server round-trip.
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

import {
  notesToMidi,
  playbackTargets,
  quantize,
  type NoteEvent,
  type PlaybackMode
} from 'logic';

import { ChordTrack } from './ChordTrack';
import { HearItAs } from './HearItAs';
import { SeeItAs } from './SeeItAs';
import { useNotationView } from './useNotationView';
import { MelodyMix } from './MelodyMix';
import { DEFAULT_MELODY_LEVEL, useMelodyBackdrop } from './useMelodyBackdrop';
import { useChordBackdrop } from './useChordBackdrop';
import type { InterpretationDto } from 'shared';

import { useChordTrack } from './useChordTrack';
import { useInterpretation } from './useInterpretation';
import { useBarLayout } from './useBarLayout';

/** Stable, so a note with no readings does not look like a new one each render. */
const EMPTY_READINGS: InterpretationDto[] = [];

import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { useTonePreview } from './useTonePreview';
import { cachedNotes } from '../../data/notesSync';
import { notesRepo } from '../../data/notesRepo';
import { writeMidi } from '../../data/files';
import { MelodyGraph } from './MelodyGraph';
import { ExportSheet } from '../Results/ExportSheet';
import { NoteList, midiToLabel } from '../Results/NoteList';
import { PlaybackBar } from './PlaybackBar';

/** Side padding of the detail scroll content (keep in sync with styles.content). */
const CONTENT_PADDING = 20;

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
  // Which reading is drawn — as sung, or as written on the grid. Separate
  // from what play sounds, so the notation can be read while the raw take is
  // heard, which is how the two are told apart (INV-NOTES-026).
  const shown = useNotationView(melody, quantized.notes, hasGrid);
  // What this person has already made of the take, kept with the note so a
  // decision outlives the screen it was made on (INV-NOTES-021).
  const interpretation = useInterpretation(note?.id ?? null, note?.interpretations ?? EMPTY_READINGS);

  // Where the bars fall. Detection proposes; a person arranges (INT-NOTES-012).
  const bars = useBarLayout(grid, note?.durationMs ?? 0, {
    savedLines: interpretation.savedBarLines,
    onArranged: interpretation.updateBarLines
  });

  const gridForView = useMemo(
    () =>
      hasGrid
        ? {
            bpm: grid.bpm,
            offsetMs: grid.offsetMs,
            beatsPerBar: grid.beatsPerBar,
            stepsPerBeat: grid.stepsPerBeat,
            // Only once someone has arranged them: before that the even
            // spacing detection proposed is what should be drawn.
            ...(bars.isArranged ? { barSteps: bars.layout.lines } : {})
          }
        : undefined,
    [hasGrid, grid.bpm, grid.offsetMs, grid.beatsPerBar, grid.stepsPerBeat, bars.isArranged, bars.layout.lines]
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
  // lines are drawn from, so chords and bars always agree. Inference runs
  // first and kept decisions land on top of it.
  const chords = useChordTrack(melody, grid, {
    savedEdits: interpretation.savedEdits,
    onEditsChanged: interpretation.update
  });
  // Play sounds this backdrop with the take, or on its own, or not at all —
  // whichever way its track is turned beside the play control (INV-NOTES-019).
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('as-sung');
  const [melodyLevel, setMelodyLevel] = useState(DEFAULT_MELODY_LEVEL);
  const melodyTones = useMemo(
    () => playbackTargets(melody, quantized.notes, playbackMode),
    [melody, quantized.notes, playbackMode]
  );
  const melodyVoice = useMelodyBackdrop(melodyTones);
  useEffect(() => melodyVoice.setLevel(melodyLevel), [melodyVoice, melodyLevel]);

  const backdrop = useChordBackdrop(chords.progression);

  // A track of its own beside the take's and the chords', turned on and off
  // there rather than from a switch under the graph. Hanging it off the chord
  // backdrop made it a passenger on a decision about harmony, and it fell
  // silent whenever chords were off (INV-NOTES-027).
  const melodyVoiceMix = useMemo(
    () => ({
      start: (offsetMs = 0) => melodyVoice.start(offsetMs),
      stop: () => melodyVoice.stop(),
      durationMs: melodyTones[melodyTones.length - 1]?.endMs ?? 0
    }),
    [melodyVoice, melodyTones]
  );
  // One voice for the melody, a tapped note and a tapped chord: the press
  // that sounds the melody is the press that stops it, and anything else
  // taking the voice ends it rather than leaving the control claiming to play
  // (INV-NOTES-031). Two questions, not one — as sung, a wrong note is the
  // detector's doing; as written, it is what transcription costs
  // (INV-NOTES-026).
  const preview = useTonePreview(melodyTones);
  const { playTones } = preview;
  const playNote = useCallback(
    (midi: number) => {
      playTones([{ midi, startMs: 0, endMs: TAP_NOTE_MS }]);
    },
    [playTones]
  );

  // A chord is just its notes sounded together, which the reference player
  // already supports: overlapping targets over the same span.
  const auditionChord = useCallback(
    (index: number) => {
      const midis = chords.voicing(index);
      if (midis.length === 0) {
        return;
      }
      playTones(
        midis.map((midi) => ({ midi, startMs: 0, endMs: chords.auditionMs }))
      );
    },
    [playTones, chords]
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
            accompaniment={backdrop}
            voice={melodyVoiceMix}
          />
        ) : null}

        {melody.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.gray500 }]}>
              {t('notes.shape')}
            </Text>
            {/* Above the graph, not below it: the control that changes the
                picture has to be visible with the picture it changes. The
                chord cards still come straight after the graph
                (INV-NOTES-029). */}
            <SeeItAs
              view={shown.view}
              onChange={shown.setView}
              canNotate={shown.canNotate}
            />
            <MelodyGraph
              notes={shown.notes}
              slots={chords.slots}
              bars={bars}
              grid={gridForView}
              width={width - 2 * CONTENT_PADDING - 2}
            />

            {/* The cards come straight after the graph, so a chord and the
                control that changes it are read together (INV-NOTES-029). */}
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

            <View style={styles.hearAs}>
              <HearItAs
                mode={playbackMode}
                onChange={setPlaybackMode}
                onPlay={preview.play}
                onStop={preview.stop}
                isPlaying={preview.isPlaying}
                canNotate={hasGrid}
              />
              <MelodyMix level={melodyLevel} onLevelChange={setMelodyLevel} />
            </View>
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
        {/* The same reading as the graph above, so the picture and the list
            never say different things about one take. */}
        <NoteList notes={shown.notes} onPressNote={playNote} />

        <ExportSheet midiUri={midiUri} title={note.title} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hearAs: { marginTop: 12 },
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
  caption: { fontSize: 12, lineHeight: 17 },
  action: { fontSize: 13, fontWeight: '700' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 16, fontWeight: '700' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
