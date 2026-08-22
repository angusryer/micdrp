/**
 * useChordToneGestures — dragging one note of a chord, and silencing it.
 *
 * Split from the painting so each file answers one question. The drag is
 * declared vertical-only: a sideways one has to reach the scrolling graph
 * underneath rather than being eaten here.
 */
import { useCallback, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { tapped } from '../utilities/haptics';
import { chordToneAt, type ChordToneRect } from './chordLayout';

/** How far from a note's centre a touch still counts as that note. */
const TOUCH_REACH = 22;

/** Pixels of drag that mean one semitone. Matches the chord card's feel. */
const SEMITONE_PX = 18;

/**
 * How long a note must be held before it is picked up.
 *
 * The band sits inside a graph that scrolls and pinches, so a finger landing
 * on a note is the common case. Without the hold, every attempt to move along
 * the take would rewrite the harmony instead (INV-NOTES-051). The same value
 * the bar lines use, so the two feel like one gesture.
 */
const PICK_UP_MS = 220;

export interface ChordToneGestureHandlers {
  onMoveTone: (slot: number, tone: number, semitones: number) => void;
  onToggleMute: (slot: number, tone: number) => void;
  /** Which note is in hand, so the band can show it. Null once let go. */
  onHold?: (held: { slot: number; tone: number } | null) => void;
}

export function useChordToneGestures(
  rects: readonly ChordToneRect[],
  { onMoveTone, onToggleMute, onHold }: ChordToneGestureHandlers
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
        // Held first, so a swipe along the take or a pinch beginning on a
        // note scrolls or zooms rather than moving it (INV-NOTES-051).
        .activateAfterLongPress(PICK_UP_MS)
        .onBegin((e) => {
          const rect = pick(e.x, e.y);
          held.current = rect ? { rect, applied: 0 } : null;
        })
        .onStart(() => {
          // Felt at the moment the note is in hand, so the hold does not have
          // to be counted out.
          const grabbed = held.current;
          if (grabbed) {
            tapped();
            onHold?.({ slot: grabbed.rect.slot, tone: grabbed.rect.tone });
          }
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
          onHold?.(null);
        })
        .runOnJS(true),
    [onHold, onMoveTone, pick]
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
