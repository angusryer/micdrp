/**
 * What governs the graph without being part of it (INV-NOTES-229).
 *
 * Two doors: what each track sounds at, and what the take measured out to.
 * They were two glyphs in two places — one at the foot of the rail, one above
 * the drawing — and neither said what it was. Two rarely-pressed doors on the
 * edges of the thing being worked on cost more attention than what is behind
 * them is worth, so they are one control now, and this is what it opens.
 *
 * Words here, unlike everywhere else on the graph. A glyph is right for a
 * control pressed while looking at something else; these are read, chosen,
 * and then not thought about again (INV-NOTES-086).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

export interface GraphMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** What each track sounds at, and in what voice (INT-NOTES-021). */
  onOptions?: () => void;
  /** What the take measured out to (INT-NOTES-023). */
  onDetails?: () => void;
}

export function GraphMenuSheet({
  isOpen,
  onClose,
  onOptions,
  onDetails
}: GraphMenuSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Closed first, then opened: both of these are sheets themselves, and a
  // sheet raised over a sheet leaves the first one to be dismissed twice.
  const go = (open?: () => void) => () => {
    onClose();
    open?.();
  };

  const rows = [
    {
      key: 'options',
      icon: 'options' as const,
      title: t('notes.graphMenuOptions'),
      why: t('notes.graphMenuOptionsWhy'),
      onPress: go(onOptions),
      testID: 'menu-options'
    },
    {
      key: 'analysis',
      icon: 'details' as const,
      title: t('notes.graphMenuAnalysis'),
      why: t('notes.graphMenuAnalysisWhy'),
      onPress: go(onDetails),
      testID: 'menu-analysis'
    }
  ];

  return (
    <Sheet
      name="graph-menu"
      isOpen={isOpen}
      onClose={onClose}
      // Sized to what is in it: two rows, and nothing behind them worth
      // watching while they are read.
      detents={['auto']}
      background={colors.neutral50}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.gray300 }]}>
          {t('notes.graphMenu')}
        </Text>
        {rows.map((row) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={row.title}
            testID={row.testID}
            onPress={row.onPress}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.neutral100,
                opacity: pressed ? 0.6 : 1
              }
            ]}
          >
            <Icon name={row.icon} size={20} color={colors.primary500} />
            <View style={styles.words}>
              <Text style={[styles.rowTitle, { color: colors.typography }]}>
                {row.title}
              </Text>
              <Text style={[styles.why, { color: colors.gray300 }]}>
                {row.why}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

export default GraphMenuSheet;

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12
  },
  words: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  why: { fontSize: 12 }
});
