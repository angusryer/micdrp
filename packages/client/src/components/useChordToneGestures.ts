/**
 * useChordToneGestures — dragging one note of a chord, and silencing it.
 *
 * Split from the painting so each file answers one question. The drag is
 * declared vertical-only: a sideways one has to reach the scrolling graph
 * underneath rather than being eaten here.
 */
import { useCallback, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { chordToneAt, type ChordToneRect } from './chordLayout';

/** How far from a note's centre a touch still counts as that note. */
const TOUCH_REACH = 22;

/** Pixels of drag that mean one semitone. Matches the chord card's feel. */
const SEMITONE_PX = 18;

export interface ChordToneGestureHandlers {
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  onToggleMute: (slot: number, tone: number) => void;
}

export function useChordToneGestures(
  rects: readonly ChordToneRect[],
  { onMoveTone, onToggleMute }: ChordToneGestureHandlers
) {
  const pick = useCallback(
    (x: number, y: number) => chordToneAt(rects, x, y, TOUCH_REACH),
    [rects]
  );

  /** The note a gesture started on, and how far it has been taken since. */
  const held = useRef<{ rect: ChordToneRect; applied: number } | null>(null);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Vertical only, so a sideways drag still reaches the scroll view
        // underneath rather than being eaten here.
        .activeOffsetY([-6, 6])
        .failOffsetX([-12, 12])
        .onBegin((e) => {
          const rect = pick(e.x, e.y);
          held.current = rect ? { rect, applied: 0 } : null;
        })
        .onUpdate((e) => {
          const grabbed = held.current;
          if (!grabbed) {
            return;
          }
          // Up is a higher pitch, and only whole semitones are ever emitted —
          // each one once, as it is crossed.
          const wanted = Math.round(-e.translationY / SEMITONE_PX);
          const step = wanted - grabbed.applied;
          if (step !== 0) {
            grabbed.applied = wanted;
            onMoveTone(grabbed.rect.slot, grabbed.rect.tone, step);
          }
        })
        .onFinalize(() => {
          held.current = null;
        })
        .runOnJS(true),
    [onMoveTone, pick]
  );

  const mute = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(250)
        .onEnd((e) => {
          const rect = pick(e.x, e.y);
          if (rect) {
            onToggleMute(rect.slot, rect.tone);
          }
        })
        .runOnJS(true),
    [onToggleMute, pick]
  );

  return useMemo(() => Gesture.Race(pan, mute), [pan, mute]);
}
