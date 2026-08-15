/**
 * ChordTrack — the harmonic backdrop under a sung idea, as a chart you can move.
 *
 * One card per bar. Drag a card VERTICALLY to move the chord through the key,
 * HORIZONTALLY to change its shape, and tap it to hear it.
 *
 * The axis is locked on the first meaningful movement of a drag. Letting a
 * gesture switch axis halfway means a slightly diagonal drag changes both the
 * root and the quality at once, and it becomes impossible to make one change
 * without risking the other.
 *
 * Vertical motion is diatonic: dragging up gives the next chord in the key,
 * not the one a semitone above. Exploring a backdrop for your own melody is
 * nearly always a search through the key, and a chromatic drag would make the
 * seven useful chords hide among twelve.
 */
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import type { ChordSlot } from 'logic';

import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** Drag distance for one scale degree, in px. */
const DEGREE_PX = 34;
/** Drag distance for one step through the chord shapes, in px. */
const SHAPE_PX = 52;
/** Movement before the gesture commits to an axis, in px. */
const AXIS_LOCK_PX = 8;

export interface ChordTrackProps {
  slots: readonly ChordSlot[];
  onNudge: (index: number, degrees: number) => void;
  onReshape: (index: number, step: number) => void;
  onAudition: (index: number) => void;
  onRevert: (index: number) => void;
}

export function ChordTrack({
  slots,
  onNudge,
  onReshape,
  onAudition,
  onRevert
}: ChordTrackProps): React.JSX.Element | null {
  if (slots.length === 0) {
    return null;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {slots.map((slot, index) => (
        <ChordCard
          key={`${index}-${slot.startMs}`}
          slot={slot}
          index={index}
          onNudge={onNudge}
          onReshape={onReshape}
          onAudition={onAudition}
          onRevert={onRevert}
        />
      ))}
    </ScrollView>
  );
}

interface CardProps {
  slot: ChordSlot;
  index: number;
  onNudge: (index: number, degrees: number) => void;
  onReshape: (index: number, step: number) => void;
  onAudition: (index: number) => void;
  onRevert: (index: number) => void;
}

function ChordCard({
  slot,
  index,
  onNudge,
  onReshape,
  onAudition,
  onRevert
}: CardProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // 0 undecided, 1 vertical (root), 2 horizontal (shape).
  const axis = useSharedValue(0);
  /** Steps already applied this drag, so each crossing fires exactly once. */
  const applied = useSharedValue(0);

  const nudge = useCallback(
    (degrees: number) => onNudge(index, degrees),
    [onNudge, index]
  );
  const reshape = useCallback(
    (step: number) => onReshape(index, step),
    [onReshape, index]
  );
  const audition = useCallback(() => onAudition(index), [onAudition, index]);
  const revert = useCallback(() => onRevert(index), [onRevert, index]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      axis.value = 0;
      applied.value = 0;
    })
    .onUpdate((event) => {
      if (axis.value === 0) {
        const dx = Math.abs(event.translationX);
        const dy = Math.abs(event.translationY);
        if (Math.max(dx, dy) < AXIS_LOCK_PX) {
          return;
        }
        axis.value = dy >= dx ? 1 : 2;
      }
      if (axis.value === 1) {
        // Screen y grows downward; dragging up should raise the chord.
        const steps = Math.round(-event.translationY / DEGREE_PX);
        if (steps !== applied.value) {
          const delta = steps - applied.value;
          applied.value = steps;
          runOnJS(nudge)(delta);
        }
        return;
      }
      const steps = Math.round(event.translationX / SHAPE_PX);
      if (steps !== applied.value) {
        const delta = steps - applied.value;
        applied.value = steps;
        runOnJS(reshape)(delta);
      }
    });

  // A tap has a max travel distance, so it cannot fire at the end of a drag.
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(audition)();
  });
  const longPress = Gesture.LongPress().onStart(() => {
    runOnJS(revert)();
  });

  const gesture = Gesture.Race(pan, longPress, tap);

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
            backgroundColor: slot.isEdited
              ? colors.primary100
              : colors.neutral100,
            borderColor: slot.isEdited ? colors.primary500 : colors.neutral500
          }
        ]}
      >
        <Text style={[styles.bar, { color: colors.gray300 }]}>{slot.bar}</Text>
        <Text style={[styles.label, { color: colors.typography }]}>
          {slot.label}
        </Text>
        <Text style={[styles.roman, { color: colors.gray300 }]}>
          {slot.roman}
        </Text>
      </View>
    </GestureDetector>
  );
}

export default ChordTrack;

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  card: {
    minWidth: 76,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 2
  },
  bar: { fontSize: 10, letterSpacing: 0.4 },
  label: { fontSize: 20, fontWeight: '700' },
  roman: { fontSize: 11, letterSpacing: 0.4 }
});
