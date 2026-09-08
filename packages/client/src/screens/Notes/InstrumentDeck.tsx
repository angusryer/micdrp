/**
 * The instruments under the graph, swiped through one at a time
 * (INV-NOTES-151).
 *
 * The graph says what was sung; these say where to put your hands to sing it
 * back. A guitar neck today, a piano next, and whatever else a line is worth
 * hearing on — so what holds them is a row rather than one drawing with a
 * control to hide it.
 *
 * Paging rather than free scrolling: an instrument half on the screen is one
 * you cannot read and cannot use, and half of two is worse than one.
 *
 * The last card says what is coming rather than letting the row end on an
 * empty edge — a row that stops without saying so reads as a row that is
 * broken.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

export interface InstrumentDeckProps {
  /** One page's width: the row holds exactly one instrument at a time. */
  width: number;
  /** The instruments themselves, in the order they are swiped through. */
  children: React.ReactNode;
}

export function InstrumentDeck({
  width,
  children
}: InstrumentDeckProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView
      testID="instrument-deck"
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      // The page under this scrolls the other way, so neither takes the
      // other's gesture.
      directionalLockEnabled
      // The graph above and the sheets below own the vertical; this owns only
      // what crosses it.
      contentContainerStyle={styles.row}
    >
      <View style={{ width }}>{children}</View>

      <View style={[styles.soon, { width }]}>
        <Text style={[styles.soonTitle, { color: colors.gray300 }]}>
          {t('notes.instrumentsSoon')}
        </Text>
        <Text style={[styles.soonWhy, { color: colors.gray100 }]}>
          {t('notes.instrumentsSoonWhy')}
        </Text>
      </View>
    </ScrollView>
  );
}

export default InstrumentDeck;

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start' },
  soon: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
    // The height of a neck, so swiping to it does not change the page's
    // shape under the finger doing the swiping.
    minHeight: 96
  },
  soonTitle: { fontSize: 14, fontWeight: '600' },
  soonWhy: { fontSize: 12, textAlign: 'center' }
});
