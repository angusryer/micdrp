/**
 * What a chord track assumes when nobody says otherwise. Kept apart so the
 * numbers have one home and the hook is only behaviour.
 */
/** How long a chord sounds when tapped, in ms. */
export const AUDITION_MS = 1100;

/**
 * The voicing floor moved into logic so the harmony can be derived with no
 * screen (INV-NOTES-259); re-exported here so the one place that read it
 * from the screen goes on reading it.
 */
export { VOICING_BOTTOM_MIDI } from 'logic';
