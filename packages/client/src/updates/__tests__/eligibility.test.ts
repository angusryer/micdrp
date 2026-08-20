/**
 * INV-UPD-001 — an App Store install never receives an over-the-air update.
 *
 * ACC-UPD-001 through ACC-UPD-004. These are the tests that decide whether a
 * beta bundle can reach a paying customer, so they assert the verdict for
 * every receipt kind rather than only the happy one.
 */
import { Platform } from 'react-native';
import { exists } from '@dr.pogodin/react-native-fs';

import { resolveEligibility } from '../eligibility';

const existsMock = exists as jest.MockedFunction<typeof exists>;

/**
 * Present exactly one receipt, in the data container where iOS actually puts
 * it — beside Documents, not inside the app bundle. Looking in the bundle is
 * what shipped in build 6 and disabled updates everywhere.
 */
const withReceipt = (
  name: 'sandboxReceipt' | 'receipt' | null,
  where: 'data' | 'bundle' = 'data'
): void => {
  const root = where === 'data' ? '/tmp/micdrp' : '/tmp/micdrp/micdrp.app';
  existsMock.mockImplementation((path: string) =>
    Promise.resolve(name !== null && path === `${root}/StoreKit/${name}`)
  );
};

describe('resolveEligibility', () => {
  // __DEV__ is injected by the RN preset rather than declared on globalThis.
  const dev = globalThis as unknown as { __DEV__: boolean };
  const realDev = dev.__DEV__;

  beforeEach(() => {
    existsMock.mockReset();
    // The production paths are what matter; __DEV__ short-circuits them.
    dev.__DEV__ = false;
    Platform.OS = 'ios';
  });

  afterEach(() => {
    dev.__DEV__ = realDev;
  });

  it('ACC-UPD-001: a sandbox receipt means TestFlight, and is eligible', async () => {
    withReceipt('sandboxReceipt');
    await expect(resolveEligibility()).resolves.toMatchObject({
      isEligible: true,
      reason: 'testflight'
    });
  });

  it('ACC-UPD-002: a store receipt means App Store, and is not eligible', async () => {
    withReceipt('receipt');
    await expect(resolveEligibility()).resolves.toMatchObject({
      isEligible: false,
      reason: 'app_store'
    });
  });

  it('ACC-UPD-003: a development build is not eligible', async () => {
    dev.__DEV__ = true;
    withReceipt('sandboxReceipt');
    await expect(resolveEligibility()).resolves.toMatchObject({
      isEligible: false,
      reason: 'development'
    });
    // The point of the assertion below: a debug build must not even look.
    expect(existsMock).not.toHaveBeenCalled();
  });

  it('ACC-UPD-004: no readable receipt is not eligible', async () => {
    withReceipt(null);
    await expect(resolveEligibility()).resolves.toMatchObject({
      isEligible: false,
      reason: 'unknown'
    });
  });

  it('fails closed when the bundle directory cannot be read', async () => {
    existsMock.mockRejectedValue(new Error('EACCES'));
    await expect(resolveEligibility()).resolves.toMatchObject({
      isEligible: false,
      reason: 'unknown'
    });
  });

  it('is not eligible on Android, which has no equivalent signal', async () => {
    Platform.OS = 'android';
    withReceipt('sandboxReceipt');
    await expect(resolveEligibility()).resolves.toMatchObject({
      isEligible: false,
      reason: 'unknown'
    });
  });
});

describe('where the receipt is looked for — INV-UPD-001', () => {
  const dev = globalThis as unknown as { __DEV__: boolean };

  beforeEach(() => {
    existsMock.mockReset();
    dev.__DEV__ = false;
    Platform.OS = 'ios';
  });

  it('ACC-UPD-030: finds it in the data container, beside Documents', async () => {
    // This is the regression. Build 6 looked only in the app bundle, found
    // nothing, and so never asked for an update at all.
    withReceipt('sandboxReceipt', 'data');
    await expect(resolveEligibility()).resolves.toMatchObject({
      isEligible: true,
      reason: 'testflight'
    });
  });

  it('still finds it in the bundle, if that is where it turns up', async () => {
    withReceipt('sandboxReceipt', 'bundle');
    await expect(resolveEligibility()).resolves.toMatchObject({
      reason: 'testflight'
    });
  });

  it('reports which receipt decided it', async () => {
    withReceipt('sandboxReceipt', 'data');
    const verdict = await resolveEligibility();
    expect(verdict.receiptPath).toBe('/tmp/micdrp/StoreKit/sandboxReceipt');
  });

  it('reports no receipt when none was found', async () => {
    withReceipt(null);
    expect((await resolveEligibility()).receiptPath).toBeNull();
  });
});
