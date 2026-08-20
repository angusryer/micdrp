/**
 * INV-UPD-001 and INV-UPD-008, at the wire.
 *
 * The eligibility test proves the verdict; this one proves the verdict is
 * *acted on* — that an ineligible install issues no request rather than
 * issuing one and discarding the answer. ACC-UPD-002 asserts exactly that, and
 * only a spy on fetch can tell the two apart.
 */
import Config from 'react-native-config';

import { resolveEligibility } from '../eligibility';
import { updatesResolver } from '../resolver';

jest.mock('../eligibility', () => ({
  resolveEligibility: jest.fn()
}));

const eligibilityMock = resolveEligibility as jest.MockedFunction<
  typeof resolveEligibility
>;

const params = {
  platform: 'ios' as const,
  appVersion: '1.0.0',
  bundleId: '00000000-0000-0000-0000-000000000000',
  minBundleId: '00000000-0000-0000-0000-000000000000',
  channel: 'beta',
  cohort: '0',
  updateStrategy: 'appVersion' as const,
  fingerprintHash: null
};

const check = () => updatesResolver.checkUpdate!(params);

describe('updatesResolver.checkUpdate', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // Call counts are the assertion in half these tests, so they have to start
    // at zero rather than carry over from the previous one.
    eligibilityMock.mockClear();
    fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'b2', status: 'UPDATE' })
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    Object.assign(Config, {
      OTA_UPDATE_URL: 'https://ota.example.com',
      OTA_CHANNEL: 'beta',
      VERSION_NUMBER: '1.0.0',
      BUILD_NUMBER: '4'
    });
    eligibilityMock.mockResolvedValue({
      isEligible: true,
      reason: 'testflight',
      receiptPath: '/data/StoreKit/sandboxReceipt'
    });
  });

  it('ACC-UPD-001: an eligible install asks, and reports what it is told', async () => {
    await expect(check()).resolves.toEqual({ id: 'b2', status: 'UPDATE' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('states the binary it is, so the server can refuse a bundle it cannot run', async () => {
    await check();
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toMatchObject({
      appVersion: '1.0.0',
      buildNumber: 4,
      channel: 'beta'
    });
  });

  it('ACC-UPD-002: an ineligible install issues no request at all', async () => {
    eligibilityMock.mockResolvedValue({
      isEligible: false,
      reason: 'app_store',
      receiptPath: '/data/StoreKit/receipt'
    });
    await expect(check()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a build with no update server configured issues no request', async () => {
    Object.assign(Config, { OTA_UPDATE_URL: '' });
    await expect(check()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // It must not even reach the receipt check — there is nothing to ask.
    expect(eligibilityMock).not.toHaveBeenCalled();
  });

  it('ACC-UPD-010: an unreachable server resolves to nothing, silently', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(check()).resolves.toBeNull();
  });

  it('INV-UPD-008: a server error resolves to nothing, silently', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(check()).resolves.toBeNull();
  });
});
