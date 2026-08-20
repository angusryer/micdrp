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

/** Present exactly one receipt, as StoreKit would. */
const withReceipt = (name: 'sandboxReceipt' | 'receipt' | null): void => {
  existsMock.mockImplementation((path: string) =>
    Promise.resolve(name !== null && path.endsWith(`StoreKit/${name}`))
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
    await expect(resolveEligibility()).resolves.toEqual({
      isEligible: true,
      reason: 'testflight'
    });
  });

  it('ACC-UPD-002: a store receipt means App Store, and is not eligible', async () => {
    withReceipt('receipt');
    await expect(resolveEligibility()).resolves.toEqual({
      isEligible: false,
      reason: 'app_store'
    });
  });

  it('ACC-UPD-003: a development build is not eligible', async () => {
    dev.__DEV__ = true;
    withReceipt('sandboxReceipt');
    await expect(resolveEligibility()).resolves.toEqual({
      isEligible: false,
      reason: 'development'
    });
    // The point of the assertion below: a debug build must not even look.
    expect(existsMock).not.toHaveBeenCalled();
  });

  it('ACC-UPD-004: no readable receipt is not eligible', async () => {
    withReceipt(null);
    await expect(resolveEligibility()).resolves.toEqual({
      isEligible: false,
      reason: 'unknown'
    });
  });

  it('fails closed when the bundle directory cannot be read', async () => {
    existsMock.mockRejectedValue(new Error('EACCES'));
    await expect(resolveEligibility()).resolves.toEqual({
      isEligible: false,
      reason: 'unknown'
    });
  });

  it('is not eligible on Android, which has no equivalent signal', async () => {
    Platform.OS = 'android';
    withReceipt('sandboxReceipt');
    await expect(resolveEligibility()).resolves.toEqual({
      isEligible: false,
      reason: 'unknown'
    });
  });
});
