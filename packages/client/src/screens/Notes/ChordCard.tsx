/**
 * ChordCard — one bar of the harmonic backdrop, as something you can move.
 *
 * Drag the card VERTICALLY to move the chord through the key, double-tap it to
 * step its shape, tap to hear it, hold to put it back.
 *
 * Nothing here answers a horizontal drag (INV-NOTES-017). A card that claimed
 * one changed a chord nobody meant to touch and pinned the track it sits in, so
 * bars past the edge of the screen could not be reached at all. The pan is
 * declared vertical-only rather than picking an axis after the fact, so the
 * scrolling track gets that drag instead of losing a race for it.
 *
 * Vertical motion is diatonic: dragging up gives the next chord in the key, not
 * the one a semitone above. Exploring a backdrop for your own melody is nearly
 * always a search through the key, and a chromatic drag would hide the seven
 * useful chords among twelve.
 */
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { ChordSlot } from 'logic';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** Drag distance for one scale degree, in px. */
const DEGREE_PX = 34;
/** Movement on either axis before the drag is claimed or given up, in px. */
const AXIS_LOCK_PX = 8;
/** How long a tap waits for a second one, in ms. Every audition pays it. */
const DOUBLE_TAP_MS = 250;

export interface ChordCardProps {
  slot: ChordSlot;
  index: number;
  /** Set by the track, which sizes a card to the chord's own span. */
  width?: number;
  onNudge: (index: number, degrees: number) => void;
  onReshape: (index: number, step: number) => void;
  onAudition: (index: number) => void;
  onRevert: (index: number) => void;
}

export function ChordCard({
  slot,
  index,
  width,
  onNudge,
  onReshape,
  onAudition,
  onRevert
}: ChordCardProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  /** Degrees already applied this drag, so each crossing fires exactly once. */
  const applied = useSharedValue(0);

  const nudge = useCallback(
    (degrees: number) => onNudge(index, degrees),
    [onNudge, index]
  );
  const reshape = useCallback(() => onReshape(index, 1), [onReshape, index]);
  const audition = useCallback(() => onAudition(index), [onAudition, index]);
  const revert = useCallback(() => onRevert(index), [onRevert, index]);

  const pan = Gesture.Pan()
    .withTestId(`chord-pan-${index}`)
    .activeOffsetY([-AXIS_LOCK_PX, AXIS_LOCK_PX])
    .failOffsetX([-AXIS_LOCK_PX, AXIS_LOCK_PX])
    .onBegin(() => {
      applied.value = 0;
    })
    .onUpdate((event) => {
      // Screen y grows downward; dragging up should raise the chord.
      const steps = Math.round(-event.translationY / DEGREE_PX);
      if (steps !== applied.value) {
        const delta = steps - applied.value;
        applied.value = steps;
        runOnJS(nudge)(delta);
      }
    });

  // The shape steps forward and wraps, so a double-tap alone reaches every
  // quality — there is no reverse gesture to hunt for.
  const doubleTap = Gesture.Tap()
    .withTestId(`chord-double-tap-${index}`)
    .numberOfTaps(2)
    .maxDelay(DOUBLE_TAP_MS)
    .onEnd(() => runOnJS(reshape)());

  // A tap has a max travel distance, so it cannot fire at the end of a drag.
  const tap = Gesture.Tap()
    .withTestId(`chord-tap-${index}`)
    .onEnd(() => runOnJS(audition)());
  const longPress = Gesture.LongPress()
    .withTestId(`chord-long-press-${index}`)
    .onStart(() => runOnJS(revert)());

  // The single tap only fires once the double tap has given up waiting.
  const taps = Gesture.Exclusive(doubleTap, tap);
  const gesture = Gesture.Race(pan, longPress, taps);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={t('notes.chordCard', {
          chord: slot.label,
          bar: slot.bar
        })}
        style={[
          styles.card,
          {
            // Nothing drawn for a card as read: the strip is its own ground
            // and the card's position already says which chord it is
            // (INV-NOTES-103). An edited one still shows, because that is a
            // claim about the take rather than decoration.
            backgroundColor: slot.isEdited ? colors.primary100 : 'transparent'
          },
          // Sized to the chord it describes, so the left edge lands on the
          // downbeat and the card covers what it is talking about.
          width != null ? { width, minWidth: 0, paddingHorizontal: 2 } : null
        ]}
      >
        {/* A faint mark on the left edge, where the downbeat is. Without a
            frame the strip is one field of text, and this is what says a
            chord starts here rather than continuing from the last
            (INV-NOTES-103). */}
        <View
          style={[styles.tick, { backgroundColor: colors.gray300 }]}
          pointerEvents="none"
        />
        {/* No bar number any more: the card sits on its own downbeat, so
            the position says what the number used to (INV-NOTES-061). */}
        <Text
          numberOfLines={1}
          style={[styles.label, { color: colors.typography }]}
        >
          {slot.label}
        </Text>
        <Text numberOfLines={1} style={[styles.roman, { color: colors.gray300 }]}>
          {slot.roman}
        </Text>
      </View>
    </GestureDetector>
  );
}

export default ChordCard;

const styles = StyleSheet.create({
  // Sized like the transport's own controls rather than twice their height:
  // the strip is a reading of the take, not the main event on the screen.
  card: {
    minWidth: 44,
    borderRadius: 8,
    paddingVertical: 2,
    // Room on the left for the tick, so the label does not sit on it.
    paddingLeft: 7,
    paddingRight: 4,
    // Left, so the name sits over the downbeat the card starts on: the card
    // is placed by its left edge (INV-NOTES-061) and centring the label moved
    // it away from the thing it names.
    alignItems: 'flex-start'
  },
  // Full height and hairline-thin: it marks the downbeat the card starts on
  // without becoming a frame again.
  tick: {
    position: 'absolute',
    left: 0,
    top: 2,
    bottom: 2,
    width: StyleSheet.hairlineWidth * 2,
    opacity: 0.5
  },
  label: { fontSize: 14, fontWeight: '700' },
  roman: { fontSize: 9, letterSpacing: 0.4 }
});
