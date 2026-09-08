/**
 * What an install says when its JavaScript fell over (INV-UPD-027).
 *
 * Shared because both ends must agree on it and neither owns it: the client
 * builds it and the update Worker writes it down, and a field spelled two ways
 * is a column that is always null.
 *
 * Nothing the singer recorded, sang, wrote or was called belongs here. A stack
 * trace and a version are the whole report — and the bundle, which is the only
 * fact that makes the rest worth keeping: bundles reach installed builds
 * without review, so "which JavaScript was this" is the first question every
 * time.
 */

/** Where an error reached the top. */
export type CrashOrigin =
  /** Caught by the boundary during a render; the app drew a recovery. */
  | 'render'
  /** Seen by the global handler; nothing below it caught it. */
  | 'global';

export interface CrashReportDto {
  /** The channel the binary asks on, so beta and production never mix. */
  channel: string;
  /** What the binary was built as. */
  appVersion: string;
  buildNumber: number;
  /**
   * The bundle actually running, or null where the binary's own is.
   *
   * Never one merely downloaded and waiting for a reload: that bundle is not
   * the JavaScript that threw.
   */
  bundleId: string | null;
  origin: CrashOrigin;
  /** Whether the app carried on afterwards, or this was the end of it. */
  survived: boolean;
  name: string;
  message: string;
  /** Truncated by the sender: a stack is evidence, not an archive. */
  stack: string;
}

/** How much of a stack is worth keeping, in characters. */
export const CRASH_STACK_LIMIT = 4000;

/** How much of a message is worth keeping, in characters. */
export const CRASH_MESSAGE_LIMIT = 500;

/** How long a name, channel or version may be. Generous, and still bounded. */
export const CRASH_FIELD_LIMIT = 120;

/** Cut a string to a limit without pretending it was not cut. */
export function clipTo(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/** A string field off untrusted JSON, clipped, never undefined. */
const text = (value: unknown, limit: number): string =>
  clipTo(typeof value === 'string' ? value : '', limit);

/**
 * Read a report off the wire without trusting any of it.
 *
 * Every field is coerced rather than validated, and nothing is ever rejected:
 * a report is diagnostic, and refusing a malformed one loses the only evidence
 * there was. A row of empty strings still says a build crashed, which is most
 * of the value.
 *
 * Here rather than in the Worker because it is the one part with rules in it,
 * and rules that cannot be run in a test are rules nobody checks — the same
 * split the who-gets-what decision already uses.
 */
export function toCrashReport(body: unknown): CrashReportDto {
  const raw = (body ?? {}) as Record<string, unknown>;
  const bundleId = raw.bundleId;
  return {
    channel: text(raw.channel, CRASH_FIELD_LIMIT),
    appVersion: text(raw.appVersion, CRASH_FIELD_LIMIT),
    buildNumber: Number(raw.buildNumber) || 0,
    // The binary's own bundle is reported as none, and so is anything that
    // is not a string: null is a fact, an empty string is a bad row.
    bundleId: typeof bundleId === 'string' && bundleId ? bundleId : null,
    origin: raw.origin === 'global' ? 'global' : 'render',
    // Survived unless it explicitly says otherwise: a report that arrived at
    // all was sent by something still running long enough to send it.
    survived: raw.survived !== false,
    name: text(raw.name, CRASH_FIELD_LIMIT),
    message: text(raw.message, CRASH_MESSAGE_LIMIT),
    stack: text(raw.stack, CRASH_STACK_LIMIT)
  };
}
