/**
 * Tapping the beat along with the take.
 *
 * One button, because there is one thing being said: here is the beat. Three
 * pads were a drum machine, which is a different instrument and a different
 * question — this is the pulse, and the pulse is singular (INV-NOTES-130).
 *
 * Armed only while the take is actually sounding. A tap against a stopped
 * transport has no moment to be at, so it would land wherever the playhead was
 * left — which is a beat placed by accident.
 *
 * Every press taps the fingertip back. The finger is not on the thing it is
 * placing, so the only confirmation available is the one in the hand.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { tapped } from '../../utilities/haptics';

export interface BeatTapProps {
  /** A press. The caller stamps it against the take's own clock. */
  onTap: () => void;
  /** False whenever the take is not sounding. */
  isArmed: boolean;
  /** How many beats have been tapped, so there is something to see. */
  count: number;
  /** The tempo they state, when there are enough to state one. */
  bpm: number | null;
  /** Throw them away. Absent until there is something to throw away. */
  onClear?: () => void;
}

export function BeatTap({
  onTap,
  isArmed,
  count,
  bpm,
  onClear
}: BeatTapProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap the beat"
        accessibilityState={{ disabled: !isArmed }}
        disabled={!isArmed}
        // On press-in, not on release: the beat is where the finger landed,
        // and waiting for it to lift would put every beat late by however
        // long it was held (INV-NOTES-130).
        onPressIn={() => {
          tapped();
          onTap();
        }}
        style={({ pressed }) => [
          styles.pad,
          {
            borderColor: isArmed ? colors.primary500 : colors.neutral500,
            backgroundColor: pressed ? colors.primary100 : colors.neutral100,
            opacity: isArmed ? 1 : 0.4
          }
        ]}
      >
        <Text
          style={[
            styles.padText,
            { color: isArmed ? colors.primary500 : colors.gray300 }
          ]}
        >
          Tap the beat
        </Text>
      </Pressable>
      <View style={styles.footer}>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {!isArmed
            ? 'Play the take, then tap along with it'
            : bpm != null
              ? `${count} beats · ${Math.round(bpm)} BPM`
              : count > 0
                ? `${count} tapped — a few more says a tempo`
                : 'Tap along with what you sang'}
        </Text>
        {onClear != null && count > 0 ? (
          <Text
            accessibilityRole="button"
            accessibilityLabel="Throw away the tapped beats"
            onPress={onClear}
            style={[styles.clear, { color: colors.primary500 }]}
          >
            Start over
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default BeatTap;

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 14 },
  // Large. This is played rather than pressed, and a small target is a
  // mistimed one.
  pad: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 26,
    alignItems: 'center'
  },
  padText: { fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  hint: { fontSize: 12 },
  clear: { fontSize: 12, fontWeight: '600' }
});
