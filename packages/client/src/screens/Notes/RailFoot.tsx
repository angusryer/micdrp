/**
 * The foot of the rail: where the take is played from (INV-NOTES-227), and
 * where the acts that remake the graph are kept (INV-NOTES-230).
 *
 * The rail's colour runs down the graph's left edge and turns right along the
 * bottom, holding the play control and the moment reached. Held rather than
 * laid over: a control floating on the drawing reads as something dropped on
 * the graph, and this is the graph's own edge continuing (INV-NOTES-142).
 *
 * Its curved end is drawn as a handle, and pulling it — or simply touching
 * the moment beside the control — opens the foot along the bottom of the
 * graph into the acts. It opens closed on every visit: a drawer left open is
 * a drawer covering the graph.
 *
 * Drawn out of the column's flow, because it is wider than the column and the
 * column's own width is what keeps the drawing where it is.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  withTiming
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';
import { PlaybackButton } from './PlaybackButton';
import { RailActs, ACT_WIDTH, type RailActsProps } from './RailActs';
import { RunClock } from './RunClock';
import type { PlaybackState } from './usePlayback';

/** How tall the foot is, in px: the control with room around it. */
export const RAIL_FOOT_HEIGHT = 56;

/** How far right it reaches closed, in px: the control and the moment. */
const SHUT_WIDTH = 150;

/** How many acts it opens into, so its open width is not a second number. */
const ACTS = 3;

/** The curve at the end, half its height: a full round rather than a corner. */
const TURN_RADIUS = RAIL_FOOT_HEIGHT / 2;

/** How far it must be dragged to count as pulled, in px. */
const PULL_MS = 24;

/** Quick, because it answers a finger already moving. */
const OPENS_IN_MS = 180;

export interface RailFootProps {
  state: PlaybackState;
  /** The value the playhead is drawn from, so the two cannot disagree. */
  positionMs: SharedValue<number>;
  /** How long the take runs, said beside the moment it has reached. */
  durationMs?: number;
  onPlay: () => void;
  /** Pause, never stop: the moment reached stays to be read (INV-NOTES-152). */
  onPause: () => void;
  /** What the handle opens into. Absent where there is nothing to offer. */
  acts?: RailActsProps | null;
}

export function RailFoot({
  state,
  positionMs,
  durationMs,
  onPlay,
  onPause,
  acts
}: RailFootProps): React.JSX.Element {
  const { colors, dimensions } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const opens = acts != null;

  const width = useAnimatedStyle(() => ({
    width: withTiming(isOpen ? SHUT_WIDTH + ACTS * ACT_WIDTH : SHUT_WIDTH, {
      duration: OPENS_IN_MS
    })
  }));

  // Pulled open, or pushed shut. A tap on the same place does the same thing,
  // because a handle that only answers a drag is a handle nobody finds.
  const pull = Gesture.Pan()
    .onEnd((e) => {
      if (Math.abs(e.translationX) > PULL_MS) {
        setIsOpen(e.translationX > 0);
      }
    })
    .runOnJS(true);

  return (
    <Animated.View
      testID="rail-foot"
      style={[
        styles.foot,
        {
          backgroundColor: colors.neutral100,
          borderBottomLeftRadius: dimensions.radii[10],
          borderColor: colors.neutral500
        },
        width
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

      {/* The moment, and the handle that opens the rest. One thing, because
          the whole end of the foot is what a hand reaches for. */}
      <GestureDetector gesture={pull}>
        <Pressable
          accessibilityRole={opens ? 'button' : 'text'}
          accessibilityLabel={opens ? t('notes.actsHandle') : undefined}
          accessibilityState={opens ? { expanded: isOpen } : undefined}
          testID="rail-handle"
          disabled={!opens}
          onPress={() => setIsOpen((was) => !was)}
          style={styles.handle}
        >
          <RunClock
            testID="rail-clock"
            positionMs={positionMs}
            ofMs={durationMs}
            color={colors.gray300}
          />
        </Pressable>
      </GestureDetector>

      {acts != null ? (
        <View style={styles.acts}>
          <RailActs {...acts} />
        </View>
      ) : null}
    </Animated.View>
  );
}

export default RailFoot;

const styles = StyleSheet.create({
  foot: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: RAIL_FOOT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    gap: 6,
    // Square where it meets the column above, curved where it leaves it —
    // and that curve is drawn rather than merely shaped, so it reads as a
    // handle rather than as where the colour happens to stop.
    borderTopRightRadius: TURN_RADIUS,
    borderBottomRightRadius: TURN_RADIUS,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    // What is past the end while it is shut, which is the acts, is not drawn
    // over the graph.
    overflow: 'hidden'
  },
  // The rest of the shut foot: the moment sits in it, and it is all handle.
  handle: {
    width: SHUT_WIDTH - 44 - 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center'
  },
  acts: { flexDirection: 'row', alignSelf: 'stretch', alignItems: 'center' }
});
