/**
 * What a spoken remark becomes, and whether a machine may act on it alone.
 *
 * `gateRequest` is the whole safety story of the dogfood loop, so it lives
 * here — in a pure package, covered by the ordinary test suite — rather than
 * inside the script that calls it. Every rule it enforces is damage that an
 * unattended loop did not do.
 *
 * It fails closed on purpose: anything it cannot positively clear is filed for
 * a human rather than built.
 *
 * Spec: .harnex/project/specs/domains/dogfood/
 */

/** What acting on a request would have to touch. */
export type BlastRadius = 'javascript' | 'native' | 'infrastructure' | 'unknown';

/** Where a request sits. */
export type RequestState =
  | 'proposed'
  | 'filed'
  | 'building'
  | 'built'
  | 'delivered'
  | 'abandoned';

/** One thing the maintainer asked for, split out of a transcript. */
export interface ChangeRequestDto {
  id: string;
  clipId: string;
  /** An imperative sentence, in the maintainer's own terms. */
  summary: string;
  /** The transcript span it came from, verbatim, so a misreading is visible. */
  quote: string;
  /** The screen it concerns, resolved from the trail, or null. */
  route: string | null;
  confidence: number;
  blastRadius: BlastRadius;
  /** Repo-relative paths the change is expected to touch. */
  paths: string[];
  state: RequestState;
}

/** Why a request was filed instead of built. */
export type FiledReason =
  | 'low confidence'
  | 'not javascript'
  | 'protected path'
  | 'no concrete change';

export interface GateVerdict {
  mayBuild: boolean;
  reason: FiledReason | null;
}

/**
 * How sure the interpretation must be before a machine acts on it alone.
 *
 * Set high deliberately. The cost of filing something that could have been
 * built is that the maintainer reads one line; the cost of building something
 * that was misheard is a change nobody asked for, shipped to a phone.
 */
export const CONFIDENCE_FLOOR = 0.8;

/**
 * Paths no unattended run may touch, at any confidence.
 *
 * These are not risky because they are hard — they are risky because their
 * failure mode is not a bad screen. A broken signing credential or release
 * script means the app cannot ship at all, which is precisely the state that
 * would prevent the loop from delivering its own fix.
 */
export const PROTECTED_PATHS = [
  'packages/client/fastlane/',
  'packages/client/ios/',
  'packages/client/android/',
  'backend/ota/',
  'scripts/release',
  'scripts/ota',
  'scripts/preflight',
  '.github/',
  '.gitsecret/',
  '.env'
] as const;

/** Does this path fall inside something the loop must not touch? */
export function isProtectedPath(path: string): boolean {
  const normalised = path.replace(/^\.\//, '');
  return PROTECTED_PATHS.some(
    (guarded) => normalised === guarded || normalised.includes(guarded)
  );
}

/**
 * May this request be built with nobody watching?
 *
 * Order matters only for which reason is reported; every test must pass. The
 * protected-path check comes first because it is the one whose consequences
 * are worst, and reporting it is the most useful thing to tell a human.
 */
export function gateRequest(request: ChangeRequestDto): GateVerdict {
  if (request.paths.some(isProtectedPath)) {
    return { mayBuild: false, reason: 'protected path' };
  }
  if (request.blastRadius !== 'javascript') {
    return { mayBuild: false, reason: 'not javascript' };
  }
  if (request.confidence < CONFIDENCE_FLOOR) {
    return { mayBuild: false, reason: 'low confidence' };
  }
  if (request.summary.trim().length === 0) {
    return { mayBuild: false, reason: 'no concrete change' };
  }
  return { mayBuild: true, reason: null };
}

/** Does a set of changed paths warrant an over-the-air bundle? */
export function shouldPublishBundle(paths: string[]): boolean {
  // Only JavaScript reaches a device over the air. A batch that changed only
  // specs or documentation is a real change worth committing and nothing
  // worth publishing.
  return paths.some((path) => /^packages\/.+\.(ts|tsx|js|jsx|json)$/.test(path));
}
