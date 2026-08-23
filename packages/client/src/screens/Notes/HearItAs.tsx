/**
 * Hear a take as it was sung, or as it was written down.
 *
 * Two different questions. As sung, a wrong note is the detector's doing and
 * worth chasing; as written, it is what transcription costs — a pure major
 * third is fourteen cents from a tempered one, and no amount of better
 * detection changes that (INV-NOTES-026).
 *
 * Without being able to switch, every complaint about playback is ambiguous
 * between the two, which is what has made the pitch detector hard to judge.
 *
 * The control that sounds it is a toggle: the press that starts the melody is
 * the press that stops it, and it says which of the two it is offering
 * (INV-NOTES-031).
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PlaybackMode } from 'logic';

import { useTheme } from '../../theme';
import { Icon } from '../../components/Icon';
import { ModeChoice, type ModeOption } from './ModeChoice';

/** Edge of the glyph on the play control, in px. */
const GLYPH = 15;

export interface HearItAsProps {
  mode: PlaybackMode;
  onChange: (mode: PlaybackMode) => void;
  onPlay: () => void;
  /** Silence a melody already sounding, from the control that started it. */
  onStop: () => void;
  /** Whether the melody is sounding now, which is what the control reports. */
  isPlaying: boolean;
  /** False when there is no grid, so notation has nothing to say. */
  canNotate: boolean;
}

const MODES: { mode: PlaybackMode; label: string; hint: string }[] = [
  { mode: 'as-sung', label: 'As sung', hint: 'exact pitch and timing detected' },
  { mode: 'as-notated', label: 'As written', hint: 'snapped to notes and beats' }
];

/**
 * The melody's own transport. The press that starts it is the press that
 * stops it, and the glyph says which one is on offer — a square rather than a
 * pause, since what it ends starts again from the top (INV-NOTES-031).
 */
function MelodyToggle({
  isPlaying,
  restingLabel,
  onPlay,
  onStop
}: {
  isPlaying: boolean;
  restingLabel: string;
  onPlay: () => void;
  onStop: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID="hear-play"
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Stop the melody' : restingLabel}
      accessibilityState={{ selected: isPlaying }}
      onPress={isPlaying ? onStop : onPlay}
      style={[
        styles.play,
        { backgroundColor: isPlaying ? colors.primary300 : colors.primary500 }
      ]}
    >
      <Icon name={isPlaying ? 'stop' : 'play'} size={GLYPH} color={colors.white} />
      <Text style={[styles.playText, { color: colors.white }]}>
        {isPlaying ? 'Stop melody' : 'Play melody'}
      </Text>
    </TouchableOpacity>
  );
}

export function HearItAs({
  mode,
  onChange,
  onPlay,
  onStop,
  isPlaying,
  canNotate
}: HearItAsProps): React.JSX.Element {
  const { colors } = useTheme();
  const active = MODES.find((m) => m.mode === mode) ?? MODES[0];
  const options: ModeOption<PlaybackMode>[] = MODES.map((m) => ({
    value: m.mode,
    label: m.label,
    // Notation needs a grid. Offering it when there is none would promise
    // something the take cannot answer.
    disabled: m.mode === 'as-notated' && !canNotate
  }));

  return (
    <View style={styles.wrap}>
      <ModeChoice
        options={options}
        value={mode}
        onChange={onChange}
        testIDPrefix="hear"
      />

      <MelodyToggle
        isPlaying={isPlaying}
        restingLabel={`Play ${active.label.toLowerCase()}`}
        onPlay={onPlay}
        onStop={onStop}
      />

      <Text style={[styles.hint, { color: colors.gray500 }]}>{active.hint}</Text>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  play: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playText: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center' }
});

export default HearItAs;
