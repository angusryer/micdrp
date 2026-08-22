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
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PlaybackMode } from 'logic';

import { useTheme } from '../../theme';
import { ModeChoice, type ModeOption } from './ModeChoice';

export interface HearItAsProps {
  mode: PlaybackMode;
  onChange: (mode: PlaybackMode) => void;
  onPlay: () => void;
  /** False when there is no grid, so notation has nothing to say. */
  canNotate: boolean;
}

const MODES: { mode: PlaybackMode; label: string; hint: string }[] = [
  { mode: 'as-sung', label: 'As sung', hint: 'exact pitch and timing detected' },
  { mode: 'as-notated', label: 'As written', hint: 'snapped to notes and beats' }
];

export function HearItAs({
  mode,
  onChange,
  onPlay,
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

      <TouchableOpacity
        testID="hear-play"
        accessibilityRole="button"
        accessibilityLabel={`Play ${active.label.toLowerCase()}`}
        onPress={onPlay}
        style={[styles.play, { backgroundColor: colors.primary500 }]}
      >
        <Text style={[styles.playText, { color: colors.white }]}>Play melody</Text>
      </TouchableOpacity>

      <Text style={[styles.hint, { color: colors.gray500 }]}>{active.hint}</Text>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  play: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  playText: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center' }
});

export default HearItAs;
