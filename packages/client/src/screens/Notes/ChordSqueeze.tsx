/**
 * ChordSqueeze — a chord too narrow, at this scale, to be a card.
 *
 * A slim upright mark with an arrowhead at each end, standing in the chord's
 * own span and no wider (INV-NOTES-063). It says there is something here and
 * what to do about it: tap and the graph zooms in about this mark until the
 * chord it stands for is wide enough to read.
 *
 * The alternative was a floor on card width, which bought legibility by
 * letting a card cover its neighbour — hiding a chord entirely, which is the
 * worst thing a strip whose job is saying which chord is where can do.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** Arrowhead size, drawn with borders so it needs no asset. */
const HEAD = 4;

export interface ChordSqueezeProps {
  /** For the label a screen reader reads, since the mark itself says nothing. */
  label: string;
  bar: number;
  onPress: () => void;
}

export function ChordSqueeze({
  label,
  bar,
  onPress
}: ChordSqueezeProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('notes.chordSqueezed', { chord: label, bar })}
      onPress={onPress}
      // The mark is only as wide as the chord, which is the point of it, so
      // the reachable area is widened rather than the drawing.
      hitSlop={{ left: 8, right: 8, top: 4, bottom: 4 }}
      style={styles.press}
    >
      <View
        style={[styles.head, { borderBottomColor: colors.primary500 }]}
      />
      <View style={[styles.stem, { backgroundColor: colors.primary500 }]} />
      <View style={[styles.tail, { borderTopColor: colors.primary500 }]} />
    </Pressable>
  );
}

export default ChordSqueeze;

const styles = StyleSheet.create({
  press: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stem: { width: 1.5, flex: 1, opacity: 0.8 },
  head: {
    width: 0,
    height: 0,
    borderLeftWidth: HEAD,
    borderRightWidth: HEAD,
    borderBottomWidth: HEAD + 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent'
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: HEAD,
    borderRightWidth: HEAD,
    borderTopWidth: HEAD + 1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent'
  }
});
