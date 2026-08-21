/**
 * Telling "the backend was briefly away" apart from "the work went wrong".
 *
 * The halt exists to stop a loop that is failing at its job (INV-DOG-010). A
 * backend that is restarting is not that: nothing was attempted, nothing was
 * damaged, and the next tick will do the same work successfully. Counting it
 * spent two of three lives during one deploy of the backend, which is a
 * routine thing to do.
 *
 * Lives here rather than beside the loop so it can be tested: scripts/ sits
 * outside the test workspaces, and a predicate nobody exercises is a guess.
 */

/** HTTP statuses that mean "ask again shortly", not "you asked wrongly". */
const RETRY_STATUS = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

/** Node and fetch names for a connection that never got anywhere. */
const RETRY_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET'
]);

/**
 * Whether a failure says something about the backend rather than the work.
 *
 * PocketBase reports an unreachable server as status 0, which is the case
 * that started this: a deploy restarting mid-run.
 */
export function isTransient(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  const e = error as { status?: unknown; code?: unknown; cause?: unknown; message?: unknown };

  if (typeof e.status === 'number' && RETRY_STATUS.has(e.status)) {
    return true;
  }
  if (typeof e.code === 'string' && RETRY_CODES.has(e.code)) {
    return true;
  }
  // fetch wraps the real reason one level down.
  if (e.cause != null && e.cause !== error && isTransient(e.cause)) {
    return true;
  }
  return typeof e.message === 'string' && /fetch failed|network request failed/i.test(e.message);
}

/**
 * Whether a failure says the thing being worked on is simply no longer there.
 *
 * Distinct from transient: asking again will not bring it back. It means
 * someone removed it, which is a decision rather than a fault, and a loop
 * that counted it would spend its lives on a maintainer tidying their list
 * (INV-DOG-026).
 */
export function isGone(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  return (error as { status?: unknown }).status === 404;
}
