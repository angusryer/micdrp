/**
 * INV-NOTES-208 — the head shown is the head, playing or not.
 *
 * Two values meant two answers. The drawn head followed where the last
 * run of playback began, and the moment a press would start from was a
 * separate number the transport kept to itself — so a rewind on a stopped
 * take set the position correctly and left the handle exactly where it
 * was. Right about the take and silent about it.
 *
 * The derivation is the fix, so the derivation is what this pins.
 */

/**
 * The rule both marks apply inside their animated style.
 *
 * A plain pick rather than a derived shared value: a derived one did not
 * recompute under the test harness, and something that cannot be checked
 * off a device is the wrong shape for a fault that only shows on one.
 */
const head = (isRunning: boolean, drawnMs: number, cueMs: number): number =>
  isRunning ? drawnMs : cueMs;

describe('where the head is', () => {
  it('follows the take while it runs', () => {
    expect(head(true, 8400, 0)).toBe(8400);
  });

  it('ACC-NOTES-058: follows the cue while it does not', () => {
    // A rewind from 12s goes back five. The handle has to go with it.
    expect(head(false, 12000, 7000)).toBe(7000);
  });

  it('does not fall back to where the last run began', () => {
    // The old behaviour: the drawn value still said 12000, so the handle
    // sat at the moment playback had last started from.
    expect(head(false, 12000, 7000)).not.toBe(12000);
  });

  it('shows a dragged head the moment it is let go', () => {
    expect(head(false, 0, 3250)).toBe(3250);
  });

  it('hands the take back the moment it starts again', () => {
    // Playing from the cue: the take's own clock takes over immediately,
    // so there is never a frame showing the old moment.
    expect(head(true, 7000, 7000)).toBe(7000);
  });
});
