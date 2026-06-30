/**
 * Unit tests for output-route (headphone) detection. The probe is pluggable, so
 * we drive both routes and the safe-default/error paths directly.
 */
import {
  detectHeadphonesConnected,
  setHeadphoneProbe
} from '../outputRoute';

afterEach(() => {
  setHeadphoneProbe(null);
});

describe('detectHeadphonesConnected', () => {
  it('defaults to false (speaker) when no probe is registered', async () => {
    await expect(detectHeadphonesConnected()).resolves.toBe(false);
  });

  it('returns true when the probe reports headphones', async () => {
    setHeadphoneProbe(() => true);
    await expect(detectHeadphonesConnected()).resolves.toBe(true);
  });

  it('awaits an async probe', async () => {
    setHeadphoneProbe(() => Promise.resolve(true));
    await expect(detectHeadphonesConnected()).resolves.toBe(true);
  });

  it('falls back to false when the probe throws', async () => {
    setHeadphoneProbe(() => {
      throw new Error('route unavailable');
    });
    await expect(detectHeadphonesConnected()).resolves.toBe(false);
  });

  it('falls back to false when the probe rejects', async () => {
    setHeadphoneProbe(() => Promise.reject(new Error('nope')));
    await expect(detectHeadphonesConnected()).resolves.toBe(false);
  });
});
