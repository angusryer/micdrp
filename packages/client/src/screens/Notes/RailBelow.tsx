/**
 * The foot of the rail's column: the doors, and the way back to the top.
 *
 * Pushed to the bottom and set apart from the mutes above by a rule and room
 * for a thumb. What is behind these is read rather than watched, and pressing
 * one by accident while reaching for a mute is worse than reaching a little
 * further.
 *
 * Its own file because the column above it is a list of switches and this is
 * three unrelated controls stacked by hand — and because TrackRail was well
 * past the file budget with both in it (Axiom 3).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { RailRewind, RAIL_REWIND_SIZE } from './RailRewind';
import { RAIL_FOOT_HEIGHT } from './RailFoot';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** The glyph each of these is drawn at, in px. */
const RAIL_GLYPH = 18;

/** One of them, with the row's padding and the column's gap. */
const RAIL_ROW = RAIL_GLYPH + 6 * 2 + 6;

/**
 * How far up from the foot of the graph the menu control sits, in px.
 *
 * Read from the things actually stacked under it — the transport's foot, the
 * rewind, the gaps around the rule between them, and the question mark
 * (INV-NOTES-232) — so what opens out of that control comes out level with it
 * rather than near it (INV-NOTES-229). The question mark ships with the menu
 * and never without it, so it is counted rather than made conditional.
 */
export const RAIL_MENU_BOTTOM =
  RAIL_FOOT_HEIGHT + RAIL_REWIND_SIZE + 22 + RAIL_ROW;

export interface RailBelowProps {
  /** Open what governs the graph from outside it (INV-NOTES-229). */
  onMenu?: () => void;
  /** Say what every mark on this column means (INV-NOTES-232). */
  onHelp?: () => void;
  /** Back to the beginning, directly above the play control. */
  onRewind?: () => void;
}

export function RailBelow({
  onMenu,
  onHelp,
  onRewind
}: RailBelowProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.below}>
      {onMenu != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notes.graphMenu')}
          testID="rail-menu"
          onPress={onMenu}
          hitSlop={6}
          style={styles.row}
        >
          <Icon name="kebab" size={RAIL_GLYPH} color={colors.gray300} />
        </Pressable>
      ) : null}

      {/* Directly under it, because the two are the same kind of thing —
          neither sounds anything and neither changes the drawing; one opens
          what governs the graph and the other says what all of this is. A
          question mark anywhere else on a column this narrow would read as one
          more control needing explaining. */}
      {onHelp != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notes.railHelp')}
          testID="rail-help"
          onPress={onHelp}
          hitSlop={6}
          style={styles.row}
        >
          <Icon name="help" size={RAIL_GLYPH} color={colors.gray300} />
        </Pressable>
      ) : null}

      {/* Between the doors and the transport, because that is where the column
          changes subject: everything above governs the graph, everything below
          plays the take. Room either side of it, so neither is pressed by
          mistake while reaching for the other. */}
      {onMenu != null && onRewind != null ? (
        <View style={[styles.rule, { backgroundColor: colors.neutral500 }]} />
      ) : null}

      {onRewind != null ? (
        <>
          <RailRewind onPress={onRewind} />
          <View style={styles.aboveFoot} />
        </>
      ) : null}
    </View>
  );
}

export default RailBelow;

const styles = StyleSheet.create({
  below: { marginTop: 'auto', width: '100%', alignItems: 'center', gap: 6 },
  row: { alignItems: 'center', paddingVertical: 6, width: '100%' },
  // Room either side, so the two controls it separates are a thumb apart.
  rule: {
    height: StyleSheet.hairlineWidth,
    width: '60%',
    marginVertical: 12
  },
  // And room under the rewind, so it is not crowded onto the play control
  // reaching out of the corner below it.
  aboveFoot: { height: 10 }
});
