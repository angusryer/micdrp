/**
 * Translating hot-updater's answer into the spec's vocabulary, and INV-UPD-008
 * — every failure here is silent and leaves the install where it was.
 */
import { HotUpdater } from '@hot-updater/react-native';

import { checkForUpdate } from '../check';
import { downloadBundle } from '../download';
import type { UpdateCheckResult } from '../types';

const checkMock = HotUpdater.checkForUpdate as jest.Mock;
const updateMock = HotUpdater.updateBundle as jest.Mock;

const offered = (over: Partial<UpdateCheckResult> = {}): UpdateCheckResult => ({
  decision: 'update',
  bundleId: 'b2',
  fileUrl: 'https://ota.example.com/b2.zip',
  fileHash: 'abc',
  ...over
});

beforeEach(() => {
  checkMock.mockReset();
  updateMock.mockReset();
});

describe('checkForUpdate', () => {
  it('reports an offer in the spec vocabulary', async () => {
    checkMock.mockResolvedValue({
      id: 'b2',
      status: 'UPDATE',
      fileUrl: 'https://ota.example.com/b2.zip',
      fileHash: 'abc'
    });
    await expect(checkForUpdate()).resolves.toEqual(offered());
  });

  it('ACC-UPD-025: a withdrawn bundle comes back as a rollback', async () => {
    checkMock.mockResolvedValue({
      id: 'nil',
      status: 'ROLLBACK',
      fileUrl: null,
      fileHash: null
    });
    await expect(checkForUpdate()).resolves.toMatchObject({
      decision: 'rollback'
    });
  });

  it('ACC-UPD-009: nothing newer is nothing to do', async () => {
    checkMock.mockResolvedValue(null);
    await expect(checkForUpdate()).resolves.toMatchObject({
      decision: 'none',
      bundleId: null
    });
  });

  it('INV-UPD-008: a thrown check is nothing to do, not an error', async () => {
    checkMock.mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate()).resolves.toMatchObject({ decision: 'none' });
  });
});

describe('downloadBundle', () => {
  it('ACC-UPD-011: a verified download becomes pending', async () => {
    updateMock.mockResolvedValue(true);
    await expect(downloadBundle(offered())).resolves.toEqual({ bundleId: 'b2' });
  });

  it('ACC-UPD-012: a refused archive stages nothing', async () => {
    // The native layer verifies the archive against its published hash and
    // returns false on a mismatch (INV-UPD-006).
    updateMock.mockResolvedValue(false);
    await expect(downloadBundle(offered())).resolves.toBeNull();
  });

  it('INV-UPD-008: a failed download stages nothing, silently', async () => {
    updateMock.mockRejectedValue(new Error('truncated'));
    await expect(downloadBundle(offered())).resolves.toBeNull();
  });

  it('does not download when there was no offer', async () => {
    await expect(downloadBundle(offered({ decision: 'none' }))).resolves.toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
