/**
 * The readout that follows a finger while it places something.
 *
 * Borrowed from the text-selection loupe: it sits above the finger and to one
 * side, never underneath, because a person cannot judge a placement they are
 * covering with their own hand (INV-NOTES-025).
 *
 * Where it goes is `loupePosition`, which is pure and tested across every
 * point on a screen. This only paints.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { placeLoupe, type LoupeBounds } from './loupePosition';

/** Big enough for two signatures and a caption, small enough to see past. */
export const LOUPE_WIDTH = 150;
export const LOUPE_HEIGHT = 58;

export interface DragLoupeProps {
  /** Hidden entirely when no drag is in flight. */
  isVisible: boolean;
  touchX: number;
  touchY: number;
  bounds: LoupeBounds;
  /** The large line: what the thing being placed will become. */
  value: string;
  /** The small line beneath it: where it is going. */
  caption?: string;
}

export function DragLoupe({
  isVisible,
  touchX,
  touchY,
  bounds,
  value,
  caption
}: DragLoupeProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!isVisible) {
    return null;
  }

  const placement = placeLoupe(touchX, touchY, bounds, {
    loupeWidth: LOUPE_WIDTH,
    loupeHeight: LOUPE_HEIGHT
  });

  return (
    <View
      pointerEvents="none"
      testID="drag-loupe"
      style={[
        styles.loupe,
        {
          left: placement.x,
          top: placement.y,
          backgroundColor: colors.neutral50,
          borderColor: colors.primary500
        }
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.value, { color: colors.typography }]}
      >
        {value}
      </Text>
      {caption != null && (
        <Text
          numberOfLines={1}
          style={[styles.caption, { color: colors.gray500 }]}
        >
          {caption}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loupe: {
    position: 'absolute',
    width: LOUPE_WIDTH,
    height: LOUPE_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
    // Raised, so it reads as sitting over the graph rather than in it.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  value: { fontSize: 17, fontWeight: '700' },
  caption: { fontSize: 12, marginTop: 2 }
});

export default DragLoupe;
