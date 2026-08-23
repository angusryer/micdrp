/**
 * The record control, in the header beside the account control.
 *
 * It remounts on every navigation, which is fine: the session it drives lives
 * in `activeSession` rather than in this component, so a recording survives
 * being navigated away from. Survival and placement are separate concerns —
 * conflating them is what produced the first version, an overlay above the
 * navigator that survived navigation and landed under the status bar where it
 * could not be pressed at all (INV-DOG-014).
 *
 * It is one control with two shapes, not two controls: round starts a clip,
 * and the square it becomes ends it and sends it. Nothing pauses — a held
 * recording is a thought the loop cannot read, and a second control beside
 * this one is a second thing to aim at in a header that has no room for it.
 *
 * The time beside it counts down to zero, never up: what a speaker needs is
 * how much is left, and at zero the clip sends itself (INV-DOG-003). The end
 * approaching is marked by colour, not by a number appearing: caution first,
 * then warning, so the first notice comes while a sentence can still be
 * brought to a close. Reaching zero raises an alert, because a speaker is
 * looking at the screen they are describing rather than at the header, and a
 * clip that ends itself in silence reads as one the app lost.
 *
 * While a take holds the microphone the control is visibly unavailable rather
 * than hidden. Hiding it would read as a bug; disabled says the app is busy.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { countdownColor, countdownLabel } from './countdown';
import { useClipControl } from './useClipControl';

export default function DogfoodControl(): React.ReactElement | null {
  const { colors } = useTheme();
  const { t } = useTranslation();
  // The session, the tick and the two ways a clip ends all live in the hook;
  // what is left here is the mark, the countdown and the touch target.
  const { view, onPress } = useClipControl(t);

  const idle = view.state === 'idle';
  // Unavailable only while idle. A take holds the microphone so a clip cannot
  // start — but a clip already running has to stay stoppable, and stopping
  // needs nothing the take is using. With the separate stop control gone,
  // disabling this one mid-clip would leave no way to send what was said.
  const unavailable = idle && !view.canRecord;

  return (
    <View style={styles.row}>
      {!idle ? (
        <Text
          style={[
            styles.time,
            { color: countdownColor(view.urgency, colors) }
          ]}>
          {countdownLabel(view.remainingMs)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={idle ? t('dogfood.record') : t('dogfood.stop')}
        accessibilityState={{ disabled: unavailable }}
        disabled={unavailable}
        onPress={() => void onPress()}
        style={styles.target}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: unavailable ? colors.gray100 : colors.error,
              opacity: unavailable ? 0.4 : 1
            },
            idle ? null : styles.recording
          ]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Laid out by the header, which already accounts for the safe area. No
  // absolute positioning here — that is what put it under the status bar.
  row: { flexDirection: 'row', alignItems: 'center' },
  /**
   * A real 44pt target, not a small mark plus hitSlop.
   *
   * hitSlop does not reserve layout space, so two neighbours can claim the
   * same points and the later one wins. The account control's padding and
   * hitSlop reach 28pt to its left, which is exactly where this sits — every
   * tap opened settings instead of recording.
   */
  target: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  time: {
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    // Fixed so the row cannot shift as the count falls through 1:00 to 0:59.
    width: 40,
    textAlign: 'right',
    marginRight: 4
  },
  dot: { width: 16, height: 16, borderRadius: 8 },
  // The same mark, squared off: what the tap does changed, so the shape does.
  recording: { borderRadius: 3 }
});
