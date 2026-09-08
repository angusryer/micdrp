/**
 * The transport, at the foot of the rail down the graph's left edge.
 *
 * A sheet opened over a note brings the graph up against the header
 * (INV-NOTES-226), which puts the playback bar off the top of the page —
 * and hearing the note is most of why it is being corrected at all. So the
 * same transport is repeated here, where it is beside the thing it is for
 * (INV-NOTES-142, INV-NOTES-227).
 *
 * Repeated, not duplicated: the same control component, the same state, and
 * the same presses, so the two can never disagree about what is sounding.
 *
 * The play control reaches out past the rail into the drawing, ringed in the
 * rail's own colour so the rail reads as wrapping around it rather than
 * ending behind it. The rail is narrower than a touch target, and the thing
 * most often aimed at should not be the thing squeezed to fit.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { PlaybackButton } from './PlaybackButton';
import { RunClock } from './RunClock';
import type { PlaybackState } from './usePlayback';

/** How far the play control overhangs the rail, in px. */
const BUBBLE = 10;

/** How much rail is drawn around it, in px. */
const RING = 4;

/** The control's own diameter, from PlaybackButton. */
const CONTROL = 44;

export interface RailTransportProps {
  state: PlaybackState;
  /** The value the playhead is drawn from, so the two cannot disagree. */
  positionMs: SharedValue<number>;
  onPlay: () => void;
  /** Pause, never stop: the moment reached stays to be read (INV-NOTES-152). */
  onPause: () => void;
  onRewind: () => void;
}

export function RailTransport({
  state,
  positionMs,
  onPlay,
  onPause,
  onRewind
}: RailTransportProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.group} testID="rail-transport">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to the beginning"
        testID="rail-rewind"
        onPress={onRewind}
        hitSlop={8}
        style={({ pressed }) => [styles.rewind, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Icon name="rewind" size={18} color={colors.gray300} />
      </Pressable>

      <View
        style={[
          styles.bubble,
          // The rail's own colour, so the column reads as swelling around
          // the control rather than the control sitting on top of it.
          { backgroundColor: colors.neutral100 }
        ]}
      >
        <PlaybackButton
          testID="rail-playback-button"
          state={state}
          // As the finger lands, like the bar's own (INV-TPORT-004).
          onPressIn={() => {
            if (state === 'playing') {
              onPause();
            }
          }}
          onPlay={onPlay}
          onPause={onPause}
        />
      </View>

      <RunClock
        testID="rail-clock"
        positionMs={positionMs}
        color={colors.gray300}
      />
    </View>
  );
}

export default RailTransport;

const styles = StyleSheet.create({
  group: { alignItems: 'center', gap: 4, width: '100%' },
  rewind: { paddingVertical: 4 },
  // Out past the rail's right edge and into the drawing, with a ring of rail
  // drawn around it.
  bubble: {
    transform: [{ translateX: BUBBLE }],
    padding: RING,
    borderRadius: (CONTROL + RING * 2) / 2
  }
});
