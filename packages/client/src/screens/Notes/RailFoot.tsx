/**
 * The foot of the rail: where the take is played from (INV-NOTES-227).
 *
 * The rail's colour runs down the graph's left edge and turns right along the
 * bottom, holding the play control and the moment reached. Held rather than
 * laid over: a control floating on the drawing reads as something dropped on
 * the graph, and this is the graph's own edge continuing (INV-NOTES-142).
 *
 * Drawn out of the column's flow, because it is wider than the column and the
 * column's own width is what keeps the drawing where it is.
 *
 * There is no second play control anywhere. The bar above the graph had one,
 * and two controls for one transport is two things to keep in step for no
 * gain — the bar was also the one that scrolls away (INV-NOTES-226).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { PlaybackButton } from './PlaybackButton';
import { RunClock } from './RunClock';
import type { PlaybackState } from './usePlayback';

/** How tall the foot is, in px: the control with room around it. */
export const RAIL_FOOT_HEIGHT = 56;

/**
 * How far right it reaches, in px: the control, the moment, and the gap.
 *
 * Room for the longest thing the clock says — a ten-minute take counted
 * against its length — because a moment that wraps or clips while it runs is
 * worse than one that is a little wide standing still.
 */
const FOOT_WIDTH = 150;

/**
 * The curve where the column turns the corner.
 *
 * Half its height, so the right edge is a full round rather than a rounded
 * rectangle: the foot reads as one shape the rail swells into.
 */
const TURN_RADIUS = RAIL_FOOT_HEIGHT / 2;

export interface RailFootProps {
  state: PlaybackState;
  /** The value the playhead is drawn from, so the two cannot disagree. */
  positionMs: SharedValue<number>;
  /** How long the take runs, said beside the moment it has reached. */
  durationMs?: number;
  onPlay: () => void;
  /** Pause, never stop: the moment reached stays to be read (INV-NOTES-152). */
  onPause: () => void;
}

export function RailFoot({
  state,
  positionMs,
  durationMs,
  onPlay,
  onPause
}: RailFootProps): React.JSX.Element {
  const { colors, dimensions } = useTheme();

  return (
    <View
      testID="rail-foot"
      style={[
        styles.foot,
        {
          backgroundColor: colors.neutral100,
          borderBottomLeftRadius: dimensions.radii[10]
        }
      ]}
    >
      <PlaybackButton
        testID="rail-playback-button"
        state={state}
        // As the finger lands, like every other transport press
        // (INV-TPORT-004).
        onPressIn={() => {
          if (state === 'playing') {
            onPause();
          }
        }}
        onPlay={onPlay}
        onPause={onPause}
      />
      <RunClock
        testID="rail-clock"
        positionMs={positionMs}
        ofMs={durationMs}
        color={colors.gray300}
        style={styles.clock}
      />
    </View>
  );
}

export default RailFoot;

const styles = StyleSheet.create({
  foot: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: FOOT_WIDTH,
    height: RAIL_FOOT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 6,
    // Square where it meets the column above, curved where it leaves it.
    borderTopRightRadius: TURN_RADIUS,
    borderBottomRightRadius: TURN_RADIUS
  },
  // The rest of the foot, so the moment is centred in what is left of it.
  clock: { flex: 1 }
});
