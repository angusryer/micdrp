/**
 * Which register a voice plays in, as one movement rather than seven presses.
 *
 * Centred at the take's own octave with three either side, so the thing you
 * sang is the middle of the control and moving away from it is plainly a
 * departure (INV-NOTES-058). A stepper made a three-octave move three taps;
 * this is one.
 *
 * Whole octaves only. Anything else changes what the melody is against the
 * harmony read from it, where an octave changes only where it sits.
 */
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { octaveLabel } from 'logic';

import { LevelSlider } from '../../components/LevelSlider';
import { useTheme } from '../../theme';

export interface OctaveSliderProps {
  octaves: number;
  /** How far it may go each way, given where the melody already sits. */
  range: { down: number; up: number };
  onChange: (octaves: number) => void;
  label?: string;
}

export function OctaveSlider({
  octaves,
  range,
  onChange,
  label = 'Octave'
}: OctaveSliderProps): React.JSX.Element {
  const { colors } = useTheme();

  // The slider speaks 0..1; this control speaks octaves. Mapped through the
  // widest span the melody allows so the middle is always the take's own
  // register, whichever side has less room.
  const reach = Math.max(1, Math.max(range.down, range.up));
  const toSlider = (value: number) => (value + reach) / (reach * 2);
  const fromSlider = useCallback(
    (position: number) => {
      const wanted = Math.round(position * reach * 2 - reach);
      // Held inside what keeps every note in MIDI range (INV-NOTES-059).
      return Math.max(-range.down, Math.min(range.up, wanted));
    },
    [reach, range.down, range.up]
  );

  return (
    <View style={styles.row}>
      <View style={styles.slider}>
        <LevelSlider
          value={toSlider(octaves)}
          onChange={(position) => onChange(fromSlider(position))}
          accessibilityLabel={`${label}, ${octaveLabel(octaves) ?? 'as sung'}`}
        />
      </View>
      {/* Beside the slider rather than above it: it is the slider's own
          reading, and a line of its own put it a row away from the thing it
          reports. */}
      <Text style={[styles.reading, { color: colors.typography }]}>
        {octaveLabel(octaves) ?? '0'}
      </Text>
    </View>
  );
}

export default OctaveSlider;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10
  },
  slider: { flex: 1 },
  // The same width the speaker occupies on the row above, so the two rows
  // line up rather than nearly lining up.
  reading: { fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center' }
});
