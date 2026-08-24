/**
 * SelectionPanel — where the selection lives when the phone is on its side.
 *
 * A sheet rising from the bottom is right upright and wrong sideways: the
 * short dimension is all graph, so anything that rises from the bottom covers
 * the thing being worked on. Held sideways there is width to spare and no
 * height to spare, so it comes in from the right edge and the graph gives up
 * width for it instead (INV-NOTES-099).
 *
 * It takes real width in the row rather than floating over the graph, because
 * covering the graph is the failure being fixed — a panel drawn on top of it
 * would hide the same bars, just from the other side.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Chosen } from '../../components/graphSelection';
import { useTheme } from '../../theme';
import { SelectionBody } from './SelectionBody';
import type { useNoteDetail } from './useNoteDetail';

/** Wide enough for a fact row to read, narrow enough to leave a graph. */
export const PANEL_WIDTH = 260;

export interface SelectionPanelProps {
  detail: ReturnType<typeof useNoteDetail>;
  selection: Chosen;
  onSelect: (selection: Chosen) => void;
}

export function SelectionPanel({
  detail,
  selection,
  onSelect
}: SelectionPanelProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const slide = useRef(new Animated.Value(PANEL_WIDTH)).current;

  useEffect(() => {
    // From off the right edge to home. Native driver, so it stays smooth
    // while the graph beside it is relaying out.
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220
    }).start();
  }, [slide]);

  if (selection.length === 0) {
    return null;
  }

  return (
    <Animated.View
      testID="selection-panel"
      style={[
        styles.panel,
        {
          backgroundColor: colors.neutral50,
          borderColor: colors.neutral500,
          transform: [{ translateX: slide }]
        }
      ]}
    >
      <View style={styles.head}>
        {/* No grabber to drag away, so there has to be a way to put it down. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Put the selection down"
          onPress={() => onSelect([])}
          hitSlop={12}
        >
          <Text style={[styles.close, { color: colors.gray300 }]}>Done</Text>
        </Pressable>
      </View>
      <SelectionBody
        detail={detail}
        selection={selection}
        onSelect={onSelect}
      />
    </Animated.View>
  );
}

export default SelectionPanel;

const styles = StyleSheet.create({
  panel: {
    width: PANEL_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    marginLeft: 10,
    overflow: 'hidden'
  },
  head: { alignItems: 'flex-end', paddingTop: 10, paddingHorizontal: 16 },
  close: { fontSize: 13, fontWeight: '600' }
});
