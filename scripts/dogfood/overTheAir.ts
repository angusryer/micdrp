/**
 * Whether a bundle can actually reach the phone (INV-DOG-005).
 *
 * The loop published bundles unconditionally, and then over-the-air delivery
 * was turned off in the app (INV-UPD-020). Nothing told the loop, so it went
 * on publishing bundles no device would ever ask for and reporting them
 * delivered — the work real, the commit real, the phone unchanged.
 *
 * The app's own setting is what this asks. One place decides whether
 * over-the-air delivery exists, and everything that depends on it reads that
 * rather than keeping a second opinion.
 */
import { readFile } from 'node:fs/promises';

/** Where the shipped app's configuration lives, relative to the repo root. */
const ENV_PATH = 'packages/client/.env.production';

/**
 * True when a published bundle would be fetched by a release build.
 *
 * False on any doubt — an unreadable env file, a missing key, an empty value.
 * Guessing yes publishes into a void and calls it delivery; guessing no costs
 * a TestFlight build, which is slower and works.
 */
export async function canSendBundles(): Promise<boolean> {
  try {
    const env = await readFile(ENV_PATH, 'utf8');
    const line = env
      .split('\n')
      .map((one) => one.trim())
      .find((one) => one.startsWith('OTA_UPDATE_URL='));
    return (line?.slice('OTA_UPDATE_URL='.length).trim().length ?? 0) > 0;
  } catch {
    return false;
  }
}
