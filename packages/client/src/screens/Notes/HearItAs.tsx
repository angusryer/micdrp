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

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { borderColor: colors.neutral500 }]}>
        {MODES.map((m) => {
          // Notation needs a grid. Offering it when there is none would
          // promise something the take cannot answer.
          const disabled = m.mode === 'as-notated' && !canNotate;
          const isOn = m.mode === mode;
          return (
            <TouchableOpacity
              key={m.mode}
              testID={`hear-${m.mode}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isOn, disabled }}
              disabled={disabled}
              onPress={() => onChange(m.mode)}
              style={[
                styles.choice,
                isOn && { backgroundColor: colors.primary500 }
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  {
                    color: disabled
                      ? colors.gray300
                      : isOn
                        ? colors.white
                        : colors.typography
                  }
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
  row: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  choice: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  choiceText: { fontSize: 14, fontWeight: '600' },
  play: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  playText: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center' }
});

export default HearItAs;
