/**
 * Barrel for the `dogfood` domain — talking to the app about the app.
 *
 * The app touches two things: `DogfoodControl` mounted above the navigator,
 * and `publishRoute` called when the visible screen changes. Everything else
 * is exported for tests and for reading.
 *
 * Not to be confused with `FeedbackDto` in `shared`, which is how well someone
 * sang. Spec: `.harnex/project/specs/domains/dogfood/`.
 */
export { default as DogfoodControl } from './DogfoodControl';
export { publishRoute, currentRoute, subscribeToRoute } from './route';
export { DogfoodSession, type FinishedClip } from './session';
export { ScreenTrail } from './trail';
export { enqueue, listPending, uploadOne, flushPending } from './upload';
export { CLIP_CAP_MS, COUNTDOWN_AT_MS, readClipOrigin } from './config';
export { newClipId } from './id';
export { runningBundleId } from './origin';
export type {
  ClipState,
  PendingClip,
  RecordingSession,
  ScreenVisit
} from './types';
