/**
 * Catching the crashes no boundary sees (INV-UPD-027).
 *
 * The error boundary catches renders, which is the minority. A throw from an
 * event handler, a promise nobody awaited, a native callback — none of those
 * pass through React at all, and those are the ones that end the process
 * rather than draw a recovery screen.
 *
 * React Native routes both to `ErrorUtils`. Installing here chains rather than
 * replaces: the existing handler is what shows the red box in development and
 * what ends the process in release, and taking that over would trade a crash
 * we can see for a crash we have hidden.
 */
import { reportCrash } from './report';

/** RN's global handler, which is not in the React Native type surface. */
type ErrorUtils = {
  getGlobalHandler: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

const errorUtils = (): ErrorUtils | undefined =>
  (globalThis as { ErrorUtils?: ErrorUtils }).ErrorUtils;

/** So a second call cannot wrap the handler around itself. */
let isWatching = false;

/**
 * Report every uncaught error, then let the app do what it was going to.
 *
 * The report is not awaited. A fatal is on its way to ending the process and
 * nothing here can hold it open; the request either leaves in the time there
 * is or it does not, and blocking the previous handler to find out would delay
 * the red box in development for a network call.
 */
export function watchForCrashes(): void {
  const utils = errorUtils();
  if (isWatching || utils == null) {
    return;
  }
  isWatching = true;

  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    void reportCrash(error, 'global', isFatal !== true);
    previous?.(error, isFatal);
  });
}

/** Test seam, like the boot module's. Never called by app code. */
export function resetWatchForTests(): void {
  isWatching = false;
}

export default watchForCrashes;
