/**
 * Capture-preview geometry for VIEW-NOTES-001.
 *
 * The spec asks for a slim band: the live pitch line is read at a glance —
 * is the line moving, roughly where does it sit — and the note list below it
 * is what the singer actually browses. Height therefore stays small enough
 * that the list keeps the larger half of the screen on a phone.
 *
 * One constant, two consumers (the Skia canvas and the frame around it), so
 * the two can never disagree about how tall the band is.
 */

/** Horizontal inset of the preview from each screen edge, in px. */
export const PITCH_LINE_MARGIN = 16;

/** Height of the live pitch trace and its frame, in px. */
export const PITCH_LINE_HEIGHT = 72;

/** Canvas width for a given screen width, inset on both sides. */
export function pitchLineWidth(screenWidth: number): number {
  return Math.max(0, screenWidth - 2 * PITCH_LINE_MARGIN);
}
