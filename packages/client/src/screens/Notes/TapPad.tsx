/**
 * Tapping a rhythm in while the take plays.
 *
 * The moment a finger lands is the moment — there is nothing to detect and
 * nothing to mistake it for, which makes this the most certain input the app
 * has (INV-NOTES-129). It works in a noisy room, it works for a part nobody
 * can sing, and it does not need the microphone at all.
 *
 * Each pad is one sound. Three rather than one, because a rhythm is a
 * conversation between a low sound and a high one, and a single pad could only
 * ever record a pulse.
 *
 * Every press taps the fingertip back. The finger is not on the thing it is
 * placing, so the only confirmation available is the one in the hand
 * (INV-NOTES-030).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { tapped } from '../../utilities/haptics';
import type { HitKind } from 'logic';

/** The sounds a pad can lay down, low to high, as the band draws them. */
const PADS: readonly { kind: HitKind; label: string }[] = [
  { kind: 'thump', label: 'Thump' },
  { kind: 'tap', label: 'Tap' },
  { kind: 'hiss', label: 'Hiss' }
];

export interface TapPadProps {
  /** A pad was pressed. The caller stamps it against the take's own clock. */
  onTap: (kind: HitKind) => void;
  /** False when nothing is playing, so there is no moment to tap against. */
  isArmed: boolean;
  /** How many have been laid down in this pass, for something to show. */
  count: number;
  /** Throw this pass away. Absent until there is something to throw away. */
  onClear?: () => void;
}

export function TapPad({
  onTap,
  isArmed,
  count,
  onClear
}: TapPadProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.pads}>
        {PADS.map((pad) => (
          <Pressable
            key={pad.kind}
            accessibilityRole="button"
            accessibilityLabel={`Tap a ${pad.label.toLowerCase()}`}
            disabled={!isArmed}
            // On press-in, not on release: the beat is where the finger
            // landed, and waiting for it to lift would put every hit late by
            // however long it was held (INV-NOTES-129).
            onPressIn={() => {
              tapped();
              onTap(pad.kind);
            }}
            style={({ pressed }) => [
              styles.pad,
              {
                borderColor: colors.neutral500,
                backgroundColor: pressed ? colors.primary100 : colors.neutral100,
                opacity: isArmed ? 1 : 0.4
              }
            ]}
          >
            <Text style={[styles.padText, { color: colors.typography }]}>
              {pad.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={[styles.hint, { color: colors.gray300 }]}>
          {isArmed
            ? count > 0
              ? `${count} tapped`
              : 'Tap along with the take'
            : 'Play the take to tap along with it'}
        </Text>
        {onClear != null && count > 0 ? (
          <Text
            accessibilityRole="button"
            accessibilityLabel="Throw away what was tapped"
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

export default TapPad;

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 14 },
  pads: { flexDirection: 'row', gap: 10 },
  // Large. This is played rather than pressed, and a small target is a
  // mistimed one.
  pad: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 22,
    alignItems: 'center'
  },
  padText: { fontSize: 14, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  hint: { fontSize: 12 },
  clear: { fontSize: 12, fontWeight: '600' }
});
