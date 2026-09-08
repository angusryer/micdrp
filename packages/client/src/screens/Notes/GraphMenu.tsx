/**
 * What governs the graph without being part of it (INV-NOTES-229).
 *
 * Two doors: what each track sounds at, and what the take measured out to.
 * They were two glyphs in two places — one at the foot of the rail, one above
 * the drawing — and neither said what it was.
 *
 * It opens out of the rail itself, rightward across the graph and level with
 * the control that opened it, because what it offers belongs to the graph. A
 * sheet rising from the bottom of the screen would say the opposite: it
 * covers the thing being worked on, and it is the gesture already spoken for
 * by the analysis and the selection, which are about the take rather than
 * about the picture of it.
 *
 * Words here, unlike everywhere else on the graph. A glyph is right for a
 * control pressed while looking at something else; these are read, chosen,
 * and then not thought about again (INV-NOTES-086).
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming
} from 'react-native-reanimated';

import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** How wide the panel is, in px. Enough for a line of words, and no more. */
const WIDTH = 232;

/** How long it takes to come out, in ms. Quick: it is a menu, not a scene. */
const OPENS_IN_MS = 160;

export interface GraphMenuProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where the rail ends, so the panel starts against it rather than over it. */
  fromX: number;
  /** How far up from the foot of the graph the control that opened it sits. */
  fromBottom: number;
  /** What each track sounds at, and in what voice (INT-NOTES-021). */
  onOptions?: () => void;
  /** What the take measured out to (INT-NOTES-023). */
  onDetails?: () => void;
}

export function GraphMenu({
  isOpen,
  onClose,
  fromX,
  fromBottom,
  onOptions,
  onDetails
}: GraphMenuProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // Slid out from behind the rail rather than faded in: it comes from the
  // control, and where a thing comes from is most of what says what it is.
  const slide = useAnimatedStyle(() => ({
    opacity: withTiming(isOpen ? 1 : 0, { duration: OPENS_IN_MS }),
    transform: [
      { translateX: withTiming(isOpen ? 0 : -WIDTH, { duration: OPENS_IN_MS }) }
    ]
  }));

  const go = (open?: () => void) => () => {
    onClose();
    open?.();
  };

  const rows = [
    {
      key: 'options',
      icon: 'options' as const,
      title: t('notes.graphMenuOptions'),
      onPress: go(onOptions),
      testID: 'menu-options'
    },
    {
      key: 'analysis',
      icon: 'details' as const,
      title: t('notes.graphMenuAnalysis'),
      onPress: go(onDetails),
      testID: 'menu-analysis'
    }
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* A touch anywhere else puts it away. Over the whole card, because
          the graph is what it is covering and a menu that survives a touch
          on the thing it governs is a menu in the way. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notes.graphMenuClose')}
        testID="menu-scrim"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        testID="graph-menu"
        style={[
          styles.panel,
          { left: fromX, bottom: fromBottom, backgroundColor: colors.neutral100 },
          slide
        ]}
      >
        {rows.map((row) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={row.title}
            testID={row.testID}
            onPress={row.onPress}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name={row.icon} size={18} color={colors.primary500} />
            <Text style={[styles.title, { color: colors.typography }]}>
              {row.title}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </>
  );
}

export default GraphMenu;

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    width: WIDTH,
    paddingVertical: 6,
    // Square where it leaves the rail, round everywhere else: it is the rail
    // opening out rather than a card resting on the graph.
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    // Above the drawing, like the rail it comes out of.
    zIndex: 2,
    elevation: 2
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  title: { fontSize: 14, fontWeight: '600' }
});
