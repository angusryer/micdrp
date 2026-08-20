/**
 * The one recording session, held outside React.
 *
 * This is what lets a recording survive navigating away. The control now
 * lives in the header, so it unmounts and remounts on every screen change —
 * if the session lived in the component, walking to another screen would end
 * the clip, and walking through the app while describing it is the point.
 *
 * The first version solved that by keeping the control outside the navigator
 * entirely, which also put it outside every screen's safe area and left it
 * unpressable under the status bar (INV-DOG-014). Survival and placement are
 * separate concerns; this file is the survival half.
 */
import { DogfoodSession } from './session';

let session: DogfoodSession | null = null;

/** The session, created on first use. */
export function activeSession(): DogfoodSession {
  session ??= new DogfoodSession();
  return session;
}

/** Test seam. Never called by app code. */
export function resetActiveSessionForTests(): void {
  session = null;
}
