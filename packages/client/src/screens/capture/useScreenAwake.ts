/**
 * Keep the screen awake for as long as this view is open (INV-NOTES-138).
 *
 * A phone that dims mid-take stopped showing the thing it was asked to show,
 * at the one moment nobody has a free hand. Only recording asks for it: every
 * other view is read between touches, and a screen that never sleeps is a
 * battery that does not last the day.
 *
 * Released on unmount whatever route the view is left by — backing out,
 * navigating on, or the screen being replaced. A flag nobody clears is a
 * phone that never sleeps again.
 */
import { useEffect } from 'react';

import NativeScreenWake from '../../specs/NativeScreenWake';

export function useScreenAwake(isAwake = true): void {
  useEffect(() => {
    if (!isAwake) {
      return;
    }
    NativeScreenWake?.setAwake(true);
    return () => NativeScreenWake?.setAwake(false);
  }, [isAwake]);
}

export default useScreenAwake;
