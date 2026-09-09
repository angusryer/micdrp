/**
 * INV-NOTES-235 — the loupe follows a finger without being re-rendered to do
 * it, and says a new thing only when there is a new thing to say.
 *
 * Its position and its words change at different rates. Where it is moves
 * every frame; what it reads changes when the note crosses a semitone. Held
 * together they were one render a frame; held apart they are one render a
 * crossing, which is what a person actually sees change.
 */
import React, { useCallback, useState } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';

import { DragLoupe } from '../DragLoupe';
import type { DragPreview } from '../useGraphGestures';
import { ThemeProvider } from '../../theme';

type Words = Pick<DragPreview, 'midi' | 'value' | 'caption'>;

let renders = 0;
let report: (p: DragPreview) => void = () => undefined;

/** The same split GraphSurface makes: position shared, words in state. */
function Surface(): React.JSX.Element {
  renders += 1;
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const [said, setSaid] = useState<Words | null>(null);

  report = useCallback(
    (next: DragPreview) => {
      touchX.value = next.x;
      touchY.value = next.y;
      setSaid((was) =>
        was != null &&
        was.midi === next.midi &&
        was.value === next.value &&
        was.caption === next.caption
          ? was
          : { midi: next.midi, value: next.value, caption: next.caption }
      );
    },
    [touchX, touchY]
  );

  return (
    <ThemeProvider>
      <DragLoupe
        isVisible={said != null}
        touchX={touchX}
        touchY={touchY}
        bounds={{ width: 400, height: 300 }}
        value={said?.value ?? ''}
        caption={said?.caption}
        midi={said?.midi}
      />
    </ThemeProvider>
  );
}

/** A frame of a drag that has not yet crossed into the next semitone. */
const sameNote = (x: number): DragPreview => ({
  x,
  y: 200,
  midi: 60,
  value: 'C4',
  caption: 'up 1'
});

beforeEach(() => {
  renders = 0;
});

it('INV-NOTES-235: twenty frames within one semitone are one render', async () => {
  await waitFor(() => render(<Surface />));
  await act(async () => report(sameNote(10)));
  const settled = renders;

  // Nineteen more frames of the finger moving, all still on the same note.
  await act(async () => {
    for (let i = 1; i < 20; i += 1) {
      report(sameNote(10 + i * 5));
    }
  });

  // Not nineteen renders, and not one a frame. React still runs the
  // component once when a setter hands back the value it already had, and
  // bails out there rather than going on to the children — so one is the
  // floor, and nineteen frames cost exactly that one.
  expect(renders - settled).toBeLessThanOrEqual(1);
});

it('INV-NOTES-235: crossing into the next semitone is worth a render', async () => {
  await waitFor(() => render(<Surface />));
  await act(async () => report(sameNote(10)));
  const settled = renders;

  await act(async () =>
    report({ x: 20, y: 200, midi: 61, value: 'C#4', caption: 'up 2' })
  );

  expect(renders).toBeGreaterThan(settled);
});
