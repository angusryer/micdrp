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
 * A row in the playback options' list of toggles, beside the tracks: it is one
 * more thing that decides what the next press will sound, so it belongs where
 * the rest of that decision is made rather than under the graph on its own.
 * Nothing here sounds anything. The transport is the only control that starts
 * a track, and the melody is one of them (INT-NOTES-026) —
 * nothing in the options starts a sound (INT-NOTES-021).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PlaybackMode } from 'logic';

import { useTheme } from '../../theme';
import { ModeChoice, type ModeOption } from './ModeChoice';

export interface HearItAsProps {
  mode: PlaybackMode;
  onChange: (mode: PlaybackMode) => void;
  /** False when there is no grid, so notation has nothing to say. */
  canNotate: boolean;
}

const MODES: { mode: PlaybackMode; label: string; hint: string }[] = [
  { mode: 'as-sung', label: 'As sung', hint: 'exact pitch and timing detected' },
  { mode: 'as-notated', label: 'As written', hint: 'snapped to notes and beats' }
];

/**
 * What the chosen reading is called, for anything that must say which one it
 * would sound. One source, so the melody control and this row cannot disagree.
 */
export function hearingLabel(mode: PlaybackMode): string {
  return (MODES.find((m) => m.mode === mode) ?? MODES[0]).label;
}

export function HearItAs({
  mode,
  onChange,
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
        label="Hear"
        options={options}
        value={mode}
        onChange={onChange}
        testIDPrefix="hear"
      />
      <Text style={[styles.hint, { color: colors.gray500 }]}>{active.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The row and its hint are one thing; the padding is what keeps the next
  // row from reading as part of it in a list this tight.
  wrap: { gap: 4, paddingVertical: 4 },
  hint: { fontSize: 12 }
});

export default HearItAs;
