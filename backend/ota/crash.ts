/**
 * Where a broken bundle reports itself (INV-UPD-027).
 *
 * Bundles reach installed builds without review, so a bad one is on every
 * tester's phone before anybody is told. The server already knows which bundle
 * each install is running, because it is the thing that handed it over
 * (INV-UPD-026) — which makes it the one place a crash can be joined to the
 * JavaScript that caused it. Anywhere else and the report is a stack trace
 * with no idea which code it came from.
 *
 * Its own module because worker.ts is the update decision and nothing else,
 * and because this endpoint has a different failure rule: a check that cannot
 * be answered is a problem, a crash that cannot be written down is not worth a
 * second failure.
 *
 * Unauthenticated, like the check it sits beside. What it accepts is a stack
 * trace against a version, from a device that already knows the URL because it
 * was compiled into the binary; a token here would be a token shipped inside
 * every IPA, which is not a secret.
 */
import { toCrashReport, type CrashReportDto } from 'shared';

import type { Env } from './worker';

/** How many crashes are kept. Enough to see a pattern, not a log. */
const CRASHES_KEPT = 500;

/**
 * Write it down, bounded, and never let the writing be the failure.
 *
 * Bounded here rather than on a schedule, for the reason the checks table is:
 * one statement, and a table only ever written by one place cannot drift
 * between them.
 */
async function remember(env: Env, report: CrashReportDto): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO crashes
       (at, channel, app_version, build_number, bundle_id,
        origin, survived, name, message, stack)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  )
    .bind(
      new Date().toISOString(),
      report.channel,
      report.appVersion,
      report.buildNumber,
      report.bundleId,
      report.origin,
      report.survived ? 1 : 0,
      report.name,
      report.message,
      report.stack
    )
    .run();

  await env.DB.prepare(
    `DELETE FROM crashes
      WHERE id <= (SELECT MAX(id) - ?1 FROM crashes)`
  )
    .bind(CRASHES_KEPT)
    .run();
}

/**
 * Take a crash report.
 *
 * Always 204, whatever happened. The device is in no position to do anything
 * with a refusal — it has just crashed — and a client that retried a rejected
 * report would be a crash loop sending a crash loop.
 */
export async function handleCrash(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    await remember(env, toCrashReport(await request.json()));
  } catch {
    // Nothing to do and nobody to tell.
  }
  return new Response(null, { status: 204 });
}
