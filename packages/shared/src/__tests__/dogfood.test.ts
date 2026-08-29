/**
 * The gate — INV-DOG-005, 006 and 007.
 *
 * Every case here is something an unattended loop was stopped from doing.
 * They matter more than the usual test because the thing they guard runs while
 * nobody is watching, on an instruction nobody reviewed.
 */
import {
  CONFIDENCE_FLOOR,
  gateRequest,
  isProtectedPath,
  deliveryRoute, shouldPublishBundle,
  type BlastRadius,
  type ChangeRequestDto
} from '../dto/dogfood';

const request = (over: Partial<ChangeRequestDto> = {}): ChangeRequestDto => ({
  id: 'r1',
  clipId: 'c1',
  summary: 'Move the record button lower on the Notes screen',
  quote: 'the record button is too close to the top on notes',
  route: 'Notes',
  confidence: 0.9,
  blastRadius: 'javascript',
  paths: ['packages/client/src/screens/Notes/NotesScreen.tsx'],
  state: 'proposed',
  ...over
});

describe('gateRequest', () => {
  it('clears a confident JavaScript change, delivered as a bundle', () => {
    expect(gateRequest(request())).toEqual({
      mayBuild: true,
      reason: null,
      route: 'bundle'
    });
  });

  it('INV-DOG-005: a native change builds, and goes to TestFlight', () => {
    // Building it is no more dangerous than any other change. What differs
    // is the ending: it cannot reach a device over the air.
    expect(gateRequest(request({ blastRadius: 'native' }))).toEqual({
      mayBuild: true,
      reason: null,
      route: 'testflight'
    });
  });

  it.each<BlastRadius>(['infrastructure', 'unknown'])(
    'INV-DOG-005: files a %s change however confident',
    (blastRadius) => {
      const verdict = gateRequest(request({ blastRadius, confidence: 0.99 }));
      expect(verdict).toMatchObject({
        mayBuild: false,
        reason: 'unclear blast radius'
      });
    }
  );

  it('INV-DOG-007: files a reading it is unsure of', () => {
    const verdict = gateRequest(request({ confidence: CONFIDENCE_FLOOR - 0.01 }));
    expect(verdict).toMatchObject({
      mayBuild: false, reason: 'low confidence' });
  });

  it('the confidence floor is inclusive', () => {
    expect(gateRequest(request({ confidence: CONFIDENCE_FLOOR })).mayBuild).toBe(
      true
    );
  });

  it('files a request that names no concrete change', () => {
    const verdict = gateRequest(request({ summary: '   ' }));
    expect(verdict).toMatchObject({
      mayBuild: false, reason: 'no concrete change' });
  });

  it.each([
    ['packages/client/fastlane/signing/signing.env'],
    ['scripts/release.sh'],
    ['scripts/ota.sh'],
    ['.github/workflows/release-ios.yml'],
    ['packages/client/.env.production'],
    ['backend/ota/worker.ts']
  ])('INV-DOG-006: files a change to %s at any confidence', (path) => {
    const verdict = gateRequest(request({ paths: [path], confidence: 1 }));
    expect(verdict).toMatchObject({
      mayBuild: false, reason: 'protected path' });
  });

  it('one protected path in a set poisons the whole request', () => {
    const verdict = gateRequest(
      request({
        paths: [
          'packages/client/src/screens/Notes/NotesScreen.tsx',
          'scripts/release.sh'
        ]
      })
    );
    expect(verdict.mayBuild).toBe(false);
  });

  it('reports the protected path even when it would otherwise build', () => {
    // The most useful thing to tell a human is the worst reason, not the
    // first one that happens to match.
    const verdict = gateRequest(
      request({ paths: ['scripts/release.sh'], blastRadius: 'native' })
    );
    expect(verdict.reason).toBe('protected path');
  });

  it('a native source file is buildable, and goes to TestFlight', () => {
    // An earlier list protected packages/client/ios wholesale, which is where
    // every native change lives — so enabling native changes and blocking
    // that directory cancelled out.
    const verdict = gateRequest(
      request({
        blastRadius: 'native',
        paths: ['packages/client/ios/micdrp/AppDelegate.mm']
      })
    );
    expect(verdict).toMatchObject({ mayBuild: true, route: 'testflight' });
  });

  it('signing material is refused even inside a native change', () => {
    const verdict = gateRequest(
      request({
        blastRadius: 'native',
        paths: ['packages/client/fastlane/signing/signing.env'],
        confidence: 1
      })
    );
    expect(verdict).toMatchObject({ reason: 'protected path' });
  });

  it('a keystore is refused wherever it lives', () => {
    expect(
      gateRequest(request({ paths: ['packages/client/android/app/micdrp.keystore'] }))
    ).toMatchObject({ reason: 'protected path' });
  });
});

describe('isProtectedPath', () => {
  it('is not fooled by a leading ./', () => {
    expect(isProtectedPath('./scripts/release.sh')).toBe(true);
  });

  it('leaves ordinary source alone', () => {
    expect(isProtectedPath('packages/logic/src/tempo.ts')).toBe(false);
  });
});

describe('shouldPublishBundle', () => {
  it('publishes when JavaScript changed', () => {
    expect(shouldPublishBundle(['packages/client/src/dogfood/session.ts'])).toBe(
      true
    );
  });

  it('ACC-DOG-024: publishes nothing when only specs changed', () => {
    expect(
      shouldPublishBundle(['.harnex/project/specs/domains/dogfood/domain.yml'])
    ).toBe(false);
  });

  it('publishes nothing for documentation alone', () => {
    expect(shouldPublishBundle(['README.md', 'docs/DEPLOYMENT.md'])).toBe(false);
  });
});

describe('which way a change goes out (INV-DOG-005)', () => {
  const js = ['packages/client/src/screens/Notes/NoteCard.tsx'];

  it('sends native code as a build, whatever is configured', () => {
    // Native cannot travel over the air at all.
    expect(deliveryRoute(true, js, true)).toBe('testflight');
    expect(deliveryRoute(true, js, false)).toBe('testflight');
  });

  it('sends javascript as a bundle where one can arrive', () => {
    expect(deliveryRoute(false, js, true)).toBe('bundle');
  });

  it('sends javascript as a build where a bundle cannot arrive', () => {
    // A delivery route that cannot deliver is worse than no route, because it
    // reports success. The loop published into a void for four days.
    expect(deliveryRoute(false, js, false)).toBe('testflight');
  });

  it('sends nothing for a batch that only moved specs', () => {
    const specs = ['.harnex/project/specs/domains/notes/invariants.yml'];
    expect(deliveryRoute(false, specs, true)).toBeNull();
    expect(deliveryRoute(false, specs, false)).toBeNull();
  });
});
