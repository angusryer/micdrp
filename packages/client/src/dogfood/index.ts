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
export { activeSession } from './activeSession';
export { ScreenTrail } from './trail';
export { enqueue, listPending, uploadOne, flushPending } from './upload';
export {
  CAUTION_AT_MS,
  CLIP_CAP_MS,
  WARNING_AT_MS,
  readClipOrigin
} from './config';
export { countdownColor, countdownLabel } from './countdown';
export { default as ShareTakeSection } from './ShareTakeSection';
export { ShareTakeControl } from './ShareTakeControl';
export { shareTake } from './samples';
export { flushShares, lastShareError } from './sampleUpload';
export { withdrawTake, refreshShared } from './sampleRecord';
export {
  pendingShare,
  pendingShares,
  sharedTake,
  type PendingShare,
  type SharedTake
} from './shares';
export { useTakeShare, type TakeShare } from './useTakeShare';
export { newClipId } from './id';
export { runningBundleId } from './origin';
export type {
  ClipState,
  CountdownUrgency,
  PendingClip,
  RecordingSession,
  ScreenVisit
} from './types';
