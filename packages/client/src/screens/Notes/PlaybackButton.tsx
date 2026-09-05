/**
 * PlaybackButton — the transport control itself: play, pause, or a spinner
 * while the take is being fetched and decoded.
 *
 * One circle in every state, carrying a triangle when a press would start the
 * take and a pair of upright bars when a press would pause it, and never a
 * word (INV-NOTES-030). Loading draws its spinner inside that same circle, so
 * the thing being aimed at never moves or changes size mid-take.
 *
 * The bars mean what they draw: the press leaves the take where it reached
 * rather than returning it to the top, so what is under the playhead can be
 * looked at and then carried on from (INV-NOTES-152).
 *
 * Split from PlaybackBar so that bar is the arrangement — control, length,
 * failure line, and the choice of what sounds — rather than all of them at
 * once. The one press it offers is the same press in every state: this
 * control is the player, never a door to one (INV-NOTES-015).
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';
import { Icon } from '../../components/Icon';
import type { PlaybackState } from './usePlayback';

/** Diameter of the control, in px — comfortably past the 44pt touch target. */
const SIZE = 44;

/** Edge of the glyph inside it. */
const GLYPH = 20;

export interface PlaybackButtonProps {
  state: PlaybackState;
  /**
   * Answered as the finger lands (INV-TPORT-004). A press that has to
   * survive until release is one anything cancelling a press can take
   * away, and something was.
   */
  onPressIn?: () => void;
  onPlay: () => void;
  /**
   * Pause, not stop: the take falls silent where it is and the moment
   * reached stays on the screen to be read (INV-NOTES-152). The glyph and
   * the label always said pause; this is the press behind them.
   */
  onPause: () => void;
}

export function PlaybackButton({
  state,
  onPressIn,
  onPlay,
  onPause
}: PlaybackButtonProps): React.JSX.Element {
  const { colors } = useTheme();
  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      accessibilityState={{ selected: isPlaying, busy: isLoading }}
      // A press while the take is still being fetched would only be swallowed
      // by usePlayback; saying so lets the platform dim it instead.
      disabled={isLoading}
      onPressIn={onPressIn}
      // Pausing on the press going down rather than coming up. A
      // transport should answer the finger landing, and a press that has
      // to survive until release is a press something else can take away.
      // Both, on purpose. Press-in answers the finger landing and cannot
      // be taken away by anything that cancels a press; onPress is still
      // here because a press that does complete must not be ignored, and
      // pausing an already-paused take is a no-op.
      onPress={isPlaying ? onPause : onPlay}
      testID="playback-button"
      style={[
        styles.button,
        { backgroundColor: isPlaying ? colors.primary300 : colors.primary500 }
      ]}
    >
      {isLoading ? (
        // No label of its own: it sits inside a control that is already
        // labelled and already reports itself busy.
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <View testID={isPlaying ? 'playback-glyph-pause' : 'playback-glyph-play'}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={GLYPH} color={colors.white} />
        </View>
      )}
    </Pressable>
  );
}

export default PlaybackButton;

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
