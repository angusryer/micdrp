/**
 * The shapes the `dogfood` domain reasons in — talking to the app about
 * the app.
 *
 * Mirrors `.harnex/project/specs/domains/dogfood/entities.yml`. Note that
 * `FeedbackDto` in `shared` is a different thing entirely: it means how well
 * someone sang. These two never share a word, which is why this domain is
 * called dogfood.
 */

/** Where a clip sits, from spoken to sent. There is no paused. */
export type ClipState = 'idle' | 'recording' | 'pending_upload' | 'uploaded';

// ScreenVisit lives in `shared`: the client writes it, the server stores it,
// and the agent loop reads it, so it cannot be defined here.
import type { ScreenVisit } from 'shared';

export type { ScreenVisit };

/**
 * A finished recording waiting to go up.
 *
 * `audioPath` is a local file until the server accepts it, at which point the
 * local copy is deleted. Nothing here holds a URL — the same lesson
 * INV-NOTES-014 taught: a signed URL is stale before anything reads it.
 */
export type PendingClip = {
  id: string;
  audioPath: string;
  durationMs: number;
  screenTrail: ScreenVisit[];
  appVersion: string;
  buildNumber: number;
  /** The over-the-air bundle running when it was recorded, or null. */
  bundleId: string | null;
  recordedAtMs: number;
};

/**
 * How close the clip is to sending itself, in the only terms the control
 * needs: which colour the countdown wears. Two steps, not one — a single
 * change at the very end arrives too late to finish a sentence differently.
 */
export type CountdownUrgency = 'none' | 'caution' | 'warning';

/**
 * The live recording, as the control renders it.
 *
 * `remainingMs` is the number the control shows, for the whole clip: what a
 * speaker needs is how much of the two minutes is left. `urgency` marks the
 * end approaching, which changes how that number looks and nothing else.
 */
export type RecordingSession = {
  /** Only ever 'idle' or 'recording': the control has two shapes, not three. */
  state: ClipState;
  elapsedMs: number;
  remainingMs: number;
  urgency: CountdownUrgency;
  /** False while a capture or practice session holds the microphone. */
  canRecord: boolean;
};

export const IDLE_SESSION: RecordingSession = {
  state: 'idle',
  elapsedMs: 0,
  remainingMs: 0,
  urgency: 'none',
  canRecord: true
};
