/**
 * INV-UPD-002 — a bundle is never offered to a binary that cannot run it.
 *
 * Every rejection asserted here is a crash that did not happen, so the suite
 * tests both sides of both boundaries rather than only the happy path.
 * Covers ACC-UPD-005 through ACC-UPD-009, ACC-UPD-025 and ACC-UPD-027.
 */
import {
  decideUpdate,
  r2ObjectKey,
  NIL_BUNDLE_ID,
  type UpdateBundleDto,
  type UpdateClientDto
} from '../dto/updateBundle';

const bundle = (over: Partial<UpdateBundleDto> = {}): UpdateBundleDto => ({
  bundleId: 'b2',
  channel: 'beta',
  targetAppVersion: '1.0.0',
  minBuildNumber: 4,
  fileUrl: 'https://ota.example.com/b2.zip',
  fileHash: 'abc',
  isEnabled: true,
  builtFromBuild: 4,
  ...over
});

const client = (over: Partial<UpdateClientDto> = {}): UpdateClientDto => ({
  channel: 'beta',
  appVersion: '1.0.0',
  buildNumber: 4,
  bundleId: NIL_BUNDLE_ID,
  ...over
});

describe('decideUpdate', () => {
  it('offers a runnable bundle newer than what is running', () => {
    expect(decideUpdate([bundle()], client())).toMatchObject({
      decision: 'update',
      bundleId: 'b2'
    });
  });

  it('ACC-UPD-005: refuses a bundle built for another app version', () => {
    const other = bundle({ targetAppVersion: '1.1.0' });
    expect(decideUpdate([other], client())).toMatchObject({ decision: 'none' });
  });

  it('ACC-UPD-006: refuses a bundle needing a newer binary', () => {
    const newer = bundle({ minBuildNumber: 5 });
    expect(decideUpdate([newer], client({ buildNumber: 4 }))).toMatchObject({
      decision: 'none'
    });
  });

  it('ACC-UPD-007: clearing the run floor is not on its own enough', () => {
    // A bundle built from build 4 is older JavaScript than a build-6 binary
    // already carries, however happily that binary could run it.
    expect(
      decideUpdate(
        [bundle({ minBuildNumber: 4, builtFromBuild: 4 })],
        client({ buildNumber: 6 })
      )
    ).toMatchObject({ decision: 'none' });
  });

  it('the build floor is inclusive', () => {
    expect(
      decideUpdate(
        [bundle({ minBuildNumber: 4, builtFromBuild: 4 })],
        client({ buildNumber: 4 })
      )
    ).toMatchObject({ decision: 'update' });
  });

  it('ACC-UPD-008: refuses a withdrawn bundle', () => {
    expect(decideUpdate([bundle({ isEnabled: false })], client())).toMatchObject({
      decision: 'none'
    });
  });

  it('never serves across channels', () => {
    const other = bundle({ channel: 'production' });
    expect(decideUpdate([other], client({ channel: 'beta' }))).toMatchObject({
      decision: 'none'
    });
  });

  it('ACC-UPD-009: offers nothing when already on the newest', () => {
    expect(decideUpdate([bundle()], client({ bundleId: 'b2' }))).toMatchObject({
      decision: 'none'
    });
  });

  it('never offers a bundle older than the one running', () => {
    const older = bundle({ bundleId: 'b1' });
    expect(decideUpdate([older], client({ bundleId: 'b2' }))).toMatchObject({
      decision: 'none'
    });
  });

  it('ACC-UPD-027: offers the newest of several runnable bundles', () => {
    const bundles = [bundle({ bundleId: 'b1' }), bundle({ bundleId: 'b3' }), bundle()];
    expect(decideUpdate(bundles, client())).toMatchObject({ bundleId: 'b3' });
  });

  it('picks the newest *runnable* one, not the newest one', () => {
    const bundles = [
      bundle({ bundleId: 'b2' }),
      bundle({ bundleId: 'b3', minBuildNumber: 9 })
    ];
    expect(decideUpdate(bundles, client({ buildNumber: 4 }))).toMatchObject({
      bundleId: 'b2'
    });
  });

  it('ACC-UPD-025: pulls an install off a bundle that was withdrawn', () => {
    const withdrawn = bundle({ bundleId: 'b2', isEnabled: false });
    expect(decideUpdate([withdrawn], client({ bundleId: 'b2' }))).toMatchObject({
      decision: 'rollback'
    });
  });

  it('rolls back even when a newer bundle exists', () => {
    const bundles = [
      bundle({ bundleId: 'b2', isEnabled: false }),
      bundle({ bundleId: 'b3' })
    ];
    expect(decideUpdate(bundles, client({ bundleId: 'b2' }))).toMatchObject({
      decision: 'rollback'
    });
  });

  it('ACC-UPD-028: withdrawing a bundle nobody runs changes nothing', () => {
    const bundles = [
      bundle({ bundleId: 'b1', isEnabled: false }),
      bundle({ bundleId: 'b2' })
    ];
    expect(decideUpdate(bundles, client({ bundleId: 'b2' }))).toMatchObject({
      decision: 'none'
    });
  });

  it('an empty server offers nothing', () => {
    expect(decideUpdate([], client())).toMatchObject({ decision: 'none' });
  });
});

describe('bundles older than the binary — INV-UPD-010', () => {
  it('refuses a bundle built from an older binary', () => {
    // The near-miss: build 7 shipped the fix that let the app ask for updates
    // at all, and the newest bundle on the channel was built from build 6.
    // Taking it would have undone the fix, with another build the only way
    // out.
    const stale = bundle({ bundleId: 'b9', minBuildNumber: 6, builtFromBuild: 6 });
    expect(decideUpdate([stale], client({ buildNumber: 7 }))).toMatchObject({
      decision: 'none'
    });
  });

  it('offers one built from the same binary', () => {
    const current = bundle({ bundleId: 'b9', minBuildNumber: 7, builtFromBuild: 7 });
    expect(decideUpdate([current], client({ buildNumber: 7 }))).toMatchObject({
      decision: 'update',
      bundleId: 'b9'
    });
  });

  it('refuses an unstamped bundle, whose age cannot be shown', () => {
    const unstamped = bundle({ bundleId: 'b9', builtFromBuild: undefined });
    expect(decideUpdate([unstamped], client({ buildNumber: 7 }))).toMatchObject({
      decision: 'none'
    });
  });

  it('picks the newest among several built from the same binary', () => {
    const older = bundle({ bundleId: 'b8', minBuildNumber: 7, builtFromBuild: 7 });
    const newer = bundle({ bundleId: 'b9', minBuildNumber: 7, builtFromBuild: 7 });
    expect(decideUpdate([older, newer], client({ buildNumber: 7 }))).toMatchObject({
      bundleId: 'b9'
    });
  });

  it('a stale bundle does not hide a current one', () => {
    const stale = bundle({ bundleId: 'b9', minBuildNumber: 6, builtFromBuild: 6 });
    const current = bundle({ bundleId: 'b8', minBuildNumber: 7, builtFromBuild: 7 });
    expect(decideUpdate([stale, current], client({ buildNumber: 7 }))).toMatchObject({
      bundleId: 'b8'
    });
  });
});

describe('r2ObjectKey', () => {
  it('drops the scheme and the bucket, which is not part of the key', () => {
    // The regression: stripping only "r2://" left the bucket glued on and
    // every archive download 404'd.
    expect(
      r2ObjectKey('r2://micdrp-ota-bundles/bundles/01a0/bundle.zip')
    ).toBe('bundles/01a0/bundle.zip');
  });

  it('handles a nested key', () => {
    expect(r2ObjectKey('r2://b/a/deep/path/file.zip')).toBe(
      'a/deep/path/file.zip'
    );
  });

  it('leaves a plain key alone', () => {
    expect(r2ObjectKey('bundles/01a0/bundle.zip')).toBe(
      'bundles/01a0/bundle.zip'
    );
  });

  it('never returns a leading slash', () => {
    expect(r2ObjectKey('r2://bucket//weird/key')).not.toMatch(/^\//);
  });
});
