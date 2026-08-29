/**
 * Where the neck is lit, read every frame on the UI thread.
 *
 * Off the same shared value the playhead is drawn from, so the neck can never
 * be a frame behind the line it is fingering — a fingering for a note you
 * have already heard is worse than no fingering (INV-NOTES-149). Nothing here
 * causes a render: the dot's coordinates are shared values the canvas reads.
 *
 * A paused take holds its position, so the place it stopped inside stays lit
 * to be read, which is the whole reason pausing exists (INV-NOTES-152).
 */
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { activePlace, type PlacedNote } from './neckPlaces';

/** Off the board entirely, where the dot parks when nothing is sounding. */
export const NOWHERE = -100;

export interface LitPlace {
  x: Readonly<SharedValue<number>>;
  y: Readonly<SharedValue<number>>;
}

export function useLitPlace(
  notes: readonly PlacedNote[],
  positionMs?: SharedValue<number> | null
): LitPlace {
  const lit = useDerivedValue(() => {
    'worklet';
    return positionMs == null ? -1 : activePlace(notes, positionMs.value);
  }, [notes, positionMs]);

  return {
    x: useDerivedValue(
      () => (lit.value < 0 ? NOWHERE : notes[lit.value].x),
      [notes]
    ),
    y: useDerivedValue(
      () => (lit.value < 0 ? NOWHERE : notes[lit.value].y),
      [notes]
    )
  };
}

export default useLitPlace;
