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

/**
 * One screen, and when during a clip it was on show.
 *
 * Offsets exclude time spent paused, so a trail offset and a transcript
 * timestamp refer to the same moment — which is what lets an interpretation
 * resolve a request to the screen it was about (INV-DOG-002).
 */
export interface ScreenVisit {
  /** The navigator route name, not a human title. */
  route: string;
  atMs: number;
}

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
  | 'unclear blast radius'
  | 'protected path'
  | 'no concrete change';

/** How a built change reaches the device. */
export type DeliveryRoute = 'bundle' | 'testflight';

export interface GateVerdict {
  mayBuild: boolean;
  reason: FiledReason | null;
  /**
   * How it would be delivered, when it may be built.
   *
   * A bundle reaches a device on its own and rolls itself back if it will
   * not boot. A TestFlight build needs the maintainer to install it, and
   * recovering from a bad one is manual. Same build, different ending —
   * which is worth saying rather than refusing to build the second kind.
   */
  route: DeliveryRoute | null;
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
 * Not because they are hard, but because their failure mode is not a bad
 * screen: a broken credential or release script means the app cannot ship at
 * all, which is precisely the state that would stop the loop delivering its
 * own fix.
 *
 * Native source is deliberately NOT here. An earlier version protected
 * packages/client/ios and android wholesale, which is where every native
 * change lives — so allowing native changes and then blocking those two
 * directories cancelled out, and nothing native could ever be built. What
 * needs guarding is the credentials and the pipeline, not the code.
 */
export const PROTECTED_PATHS = [
  // Signing material and the lanes that use it.
  'packages/client/fastlane/',
  '.p12',
  '.keystore',
  '.mobileprovision',
  // Secrets, and the env files compiled into the binary.
  '.gitsecret/',
  '.env',
  // The pipeline that ships and verifies. Breaking any of these is how the
  // loop would lose the ability to deliver its own fix.
  'scripts/release',
  'scripts/ota',
  'scripts/preflight',
  '.github/',
  'backend/ota/'
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
  const filed = (reason: FiledReason): GateVerdict => ({
    mayBuild: false,
    reason,
    route: null
  });

  if (request.paths.some(isProtectedPath)) {
    return filed('protected path');
  }
  // Infrastructure and unknown stay filed. Not because they are hard, but
  // because their failure mode is an app that cannot ship at all — which is
  // the one state that would stop the loop delivering its own fix.
  if (
    request.blastRadius !== 'javascript' &&
    request.blastRadius !== 'native'
  ) {
    return filed('unclear blast radius');
  }
  if (request.confidence < CONFIDENCE_FLOOR) {
    return filed('low confidence');
  }
  if (request.summary.trim().length === 0) {
    return filed('no concrete change');
  }
  return {
    mayBuild: true,
    reason: null,
    route: request.blastRadius === 'javascript' ? 'bundle' : 'testflight'
  };
}

/** Does a set of changed paths warrant an over-the-air bundle? */
export function shouldPublishBundle(paths: string[]): boolean {
  // Only JavaScript reaches a device over the air. A batch that changed only
  // specs or documentation is a real change worth committing and nothing
  // worth publishing.
  return paths.some((path) => /^packages\/.+\.(ts|tsx|js|jsx|json)$/.test(path));
}
