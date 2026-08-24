/**
 * The readout that follows a finger while it places something.
 *
 * Borrowed from the text-selection loupe: it sits above the finger and to one
 * side, never underneath, because a person cannot judge a placement they are
 * covering with their own hand (INV-NOTES-025).
 *
 * Where it goes is `loupePosition`, which is pure and tested across every
 * point on a screen. This only paints.
 *
 * It shows the note itself, not only its name. The name alone answers "what
 * will this become" and leaves "where is that" to be worked out from a word —
 * so a strip of the lanes around it comes too, with the note drawn in its own,
 * the way the text cursor's bubble shows the letters either side of where it
 * would land (INV-NOTES-110).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { LOUPE_OFFSET, placeLoupe, type LoupeBounds } from './loupePosition';

/** Big enough for the lanes, two signatures and a caption; still see-past. */
export const LOUPE_WIDTH = 178;
export const LOUPE_HEIGHT = 74;

/** Semitones shown either side of the note, so the move has somewhere to go. */
const NEIGHBOURS = 2;
const LANE_HEIGHT = 11;

/**
 * Headroom a surface needs above a touch for the loupe to clear the finger.
 * A surface shorter than this should let the loupe overhang it by setting
 * `bounds.top` to `-LOUPE_CLEARANCE` (INV-NOTES-025).
 */
export const LOUPE_CLEARANCE = LOUPE_HEIGHT + LOUPE_OFFSET;

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
  /**
   * The pitch it would become. Given, the loupe draws the lanes around it and
   * puts the note in its own, so the move is visible rather than only named.
   */
  midi?: number;
}

export function DragLoupe({
  isVisible,
  touchX,
  touchY,
  bounds,
  value,
  caption,
  midi
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
      {midi != null ? (
        <View testID="loupe-lanes" style={styles.lanes}>
          {/* Highest at the top, as on the graph: the strip is a slice of the
              same picture, so up here means up there. */}
          {Array.from({ length: NEIGHBOURS * 2 + 1 }, (_, row) => {
            const pitch = midi + NEIGHBOURS - row;
            const isNote = pitch === midi;
            return (
              <View key={pitch} style={styles.lane}>
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: isNote
                        ? colors.primary500
                        : colors.neutral300
                    },
                    isNote ? styles.here : null
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={styles.words}>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Raised, so it reads as sitting over the graph rather than in it.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  lanes: { justifyContent: 'center' },
  lane: { height: LANE_HEIGHT, justifyContent: 'center' },
  // A neighbour is a rule; the note itself is a bar sitting in its lane.
  bar: { width: 26, height: 2, borderRadius: 1, opacity: 0.7 },
  here: { height: 6, borderRadius: 3, opacity: 1 },
  words: { flex: 1, justifyContent: 'center' },
  value: { fontSize: 17, fontWeight: '700' },
  caption: { fontSize: 12, marginTop: 2 }
});

export default DragLoupe;
