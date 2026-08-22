/**
 * What a chord track assumes when nobody says otherwise. Kept apart so the
 * numbers have one home and the hook is only behaviour.
 */
/** How long a chord sounds when tapped, in ms. */
export const AUDITION_MS = 1100;

/**
 * Sits below a sung line without booming under it — the right register on
 * headphones. A caller listening on the phone's own speaker passes a higher
 * floor, since a built-in speaker has almost nothing down here.
 */
export const VOICING_BOTTOM_MIDI = 48;
