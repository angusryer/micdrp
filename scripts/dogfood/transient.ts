/**
 * Riding out a backend that is briefly away.
 *
 * What counts as "briefly away" lives in shared, where it can be tested;
 * this is only the waiting.
 */
// Imported by file rather than through the barrel: Node's ESM loader needs
// explicit extensions.
import { isTransient } from '../../packages/shared/src/transient.ts';

export { isTransient };

/**
 * Do something, trying again while the backend is the thing at fault.
 *
 * Short and few: a run happens every five minutes anyway, so this is for
 * riding out a restart, not for waiting out an outage.
 */
export async function withRetry<T>(
  work: () => Promise<T>,
  attempts = 3,
  delayMs = 2000,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      last = error;
      if (!isTransient(error) || attempt === attempts) {
        throw error;
      }
      await sleep(delayMs * attempt);
    }
  }
  throw last;
}
