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
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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

/**
 * Room between the last act and that bar, in px.
 *
 * More than the gap between one act and the next: the bar is a handle, and a
 * glyph pressed right up against the thing you pull is a glyph you catch
 * while pulling.
 */
const TAIL = 16;

/** How much of it is open, in px, when it is all the way open. */
const OPENS_BY = ACTS * ACT_WIDTH + TAIL;

/** How far a thumb must travel before the drag is a drag and not a press. */
const IS_A_DRAG = 8;

/** How much a flick counts for, in px per px-per-second of what it was doing. */
const FLICK_WEIGHT = 0.15;

/** The bar down the handle's edge: thick enough to be aimed at, in px. */
const HANDLE_BAR = 3;

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

  /**
   * How far open it is, in px, on the UI thread.
   *
   * It follows the thumb, so it changes every frame and cannot be state: a
   * width re-rendered sixty times a second re-renders the graph beside it
   * (INV-NOTES-206). What React is told is only which of the two states it
   * settled in, which changes twice a gesture.
   */
  const openBy = useSharedValue(0);
  /** Where it was when the thumb landed, so a drag is measured from there. */
  const wasAt = useSharedValue(0);

  const width = useAnimatedStyle(() => ({ width: SHUT_WIDTH + openBy.value }));

  /** Settle on one state or the other; never between two. */
  const settle = useCallback(
    (open: boolean) => {
      openBy.value = withTiming(open ? OPENS_BY : 0, {
        duration: OPENS_IN_MS
      });
      setIsOpen(open);
    },
    [openBy]
  );

  // Follows the thumb both ways, and only as far as there is to open. Over
  // the moment and the acts rather than the handle alone: what is being moved
  // is the foot, and a drawer that can only be pulled by one corner has to be
  // aimed at twice. It claims the touch only after real sideways travel, so
  // every act underneath still answers a press of its own.
  //
  // Not over the play control, which answers the finger landing rather than
  // leaving (INV-TPORT-004) — a drag begun on it would pause the take before
  // the drag had been recognised as one.
  const pull = Gesture.Pan()
    .enabled(opens)
    .activeOffsetX([-IS_A_DRAG, IS_A_DRAG])
    .onBegin(() => {
      wasAt.value = openBy.value;
    })
    .onUpdate((e) => {
      const wanted = wasAt.value + e.translationX;
      openBy.value = wanted < 0 ? 0 : wanted > OPENS_BY ? OPENS_BY : wanted;
    })
    .onEnd((e) => {
      // Where it would come to rest if it kept going: a flick opens it even
      // from a short drag, which is what a flick means.
      const carried = openBy.value + e.velocityX * FLICK_WEIGHT;
      runOnJS(settle)(carried > OPENS_BY / 2);
    });

  return (
    <Animated.View
      testID='rail-foot'
      style={[
        styles.foot,
        {
          backgroundColor: colors.neutral100,
          borderBottomLeftRadius: dimensions.radii[10],
          // Down this edge alone, in the colour the app acts in. A border
          // around the whole foot drew a line between the play control and
          // the rewind directly above it, which are one column and not two.
          borderRightColor: opens ? colors.primary500 : 'transparent'
        },
        width
      ]}>
      <PlaybackButton
        testID='rail-playback-button'
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

      {/* Everything a drag may be started on. */}
      <GestureDetector gesture={pull}>
        <View style={styles.pullable}>
          {/* The moment, and the press that opens the rest without a
                drag. */}
          <Pressable
            accessibilityRole={opens ? 'button' : 'text'}
            accessibilityLabel={opens ? t('notes.actsHandle') : undefined}
            accessibilityState={opens ? { expanded: isOpen } : undefined}
            testID='rail-handle'
            disabled={!opens}
            onPress={() => settle(!isOpen)}
            style={styles.handle}>
            <RunClock
              testID='rail-clock'
              positionMs={positionMs}
              ofMs={durationMs}
              color={colors.gray300}
            />
          </Pressable>

          {acts != null ? (
            <View style={styles.acts}>
              <RailActs {...acts} />
            </View>
          ) : null}
        </View>
      </GestureDetector>
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
    borderRightWidth: HANDLE_BAR,
    // What is past the end while it is shut, which is the acts, is not drawn
    // over the graph.
    overflow: 'hidden'
  },
  // Everything right of the play control: the moment, and the acts behind it.
  pullable: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center'
  },
  // The rest of the shut foot: the moment sits in it, and it is all handle.
  handle: {
    width: SHUT_WIDTH - 44 - 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center'
  },
  acts: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingRight: TAIL
  }
});
