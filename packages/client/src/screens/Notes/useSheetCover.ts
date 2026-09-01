/**
 * How much of the page the open sheets are covering (INV-NOTES-191).
 *
 * Per sheet, and the page keeps room for whichever needs most. Two sheets
 * wrote one number, so whichever was dismissed first set the room to zero
 * while the other was still covering the page — which is INV-NOTES-109
 * failing again through a door it was not written for. The analysis sheet and
 * the selection sheet are open together whenever a note is chosen while the
 * knobs are being turned, which is most of the time they are turned at all.
 */
import { useCallback, useMemo, useState } from 'react';

export function useSheetCover() {
  const [byName, setByName] = useState<Record<string, number>>({});

  /** What one sheet is covering. Zero when it has gone. */
  const report = useCallback((name: string, px: number) => {
    setByName((was) =>
      (was[name] ?? 0) === px ? was : { ...was, [name]: px }
    );
  }, []);

  // The largest, not the sum: sheets are stacked over one another rather than
  // laid end to end, so two of them cover as much as the taller one does.
  const cover = useMemo(
    () => Math.max(0, ...Object.values(byName), 0),
    [byName]
  );

  return { cover, report };
}
