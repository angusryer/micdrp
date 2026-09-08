/**
 * Telling the server that the JavaScript fell over (INV-UPD-027).
 *
 * A bundle is published straight onto installed builds. Nothing reviews it and
 * nothing announces it, so a bad one is running on every tester's phone before
 * anybody says a word — and the only reason we ever hear is that somebody
 * happens to mention it. This is the other route.
 *
 * It goes to the update server rather than to a crash service because the
 * update server is the one thing that knows which bundle this install took
 * (INV-UPD-026). A stack trace with no bundle beside it cannot tell a fault in
 * yesterday's publish from a fault in the binary.
 *
 * Quiet, in the same way the check is quiet: no dialogue, no retry, and no
 * throw. This is called from inside a boundary that has already caught
 * something, and an error escaping from here would turn one broken screen into
 * a broken app.
 */
import {
  CRASH_MESSAGE_LIMIT,
  CRASH_STACK_LIMIT,
  clipTo,
  type CrashOrigin,
  type CrashReportDto
} from 'shared';

import { runningBundle } from './bundle';
import { readUpdatesConfig } from './config';
import { isConfigured } from './types';

/**
 * How long to wait before giving up, in ms.
 *
 * Shorter than the update check's. That one is racing a splash screen; this
 * one may be racing the process being killed, and a report that has not left
 * by then was never going to.
 */
const REQUEST_TIMEOUT_MS = 3000;

/** What an unknown throw amounts to, whatever it actually was. */
const describe = (error: unknown): { name: string; message: string; stack: string } => {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: clipTo(error.message || '', CRASH_MESSAGE_LIMIT),
      stack: clipTo(error.stack || '', CRASH_STACK_LIMIT)
    };
  }
  return {
    name: 'Error',
    // Whatever was thrown, said as briefly as it can be said. A thrown string
    // or object is rare and still worth a row.
    message: clipTo(String(error), CRASH_MESSAGE_LIMIT),
    stack: ''
  };
};

/**
 * Report a crash, if there is anywhere to report it to.
 *
 * An install with no update server sends nothing, and needs no rule of its own
 * to do so: a build that may not take a bundle has no bundle to blame, and the
 * absent URL is the same gate that keeps an App Store binary from asking for
 * beta JavaScript (INV-UPD-001).
 *
 * Never rejects. Callers are recovering from something already.
 */
export async function reportCrash(
  error: unknown,
  origin: CrashOrigin,
  survived: boolean
): Promise<void> {
  try {
    const config = readUpdatesConfig();
    if (!isConfigured(config)) {
      return;
    }

    const report: CrashReportDto = {
      channel: config.channel,
      appVersion: config.appVersion,
      buildNumber: config.buildNumber,
      // What is running, never what is merely downloaded: a staged bundle is
      // not the JavaScript that threw.
      bundleId: runningBundle(),
      origin,
      survived,
      ...describe(error)
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      await fetch(`${config.updateUrl.replace(/\/$/, '')}/crash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // A report that could not be sent is not worth a second failure.
  }
}
