/**
 * INV-NOTES-185 — a take held only on the server is fetched before it is read.
 *
 * The analyser reads with AVAudioFile, which opens local files only. Handed
 * an https URL it built a nonsense file path out of it and failed, so a take
 * whose local copy had gone — every take after a reinstall — could be played
 * but not re-read.
 */
import {
  downloadFile,
  exists,
  unlink
} from '@dr.pogodin/react-native-fs';

import { isOnDisk, localCopyOf } from '../localCopy';

const fs = {
  exists: exists as jest.Mock,
  unlink: unlink as jest.Mock,
  downloadFile: downloadFile as jest.Mock
};

beforeEach(() => {
  fs.exists.mockReset().mockResolvedValue(true);
  fs.unlink.mockReset().mockResolvedValue(undefined);
  fs.downloadFile
    .mockReset()
    .mockReturnValue({ promise: Promise.resolve({ statusCode: 200 }) });
});

describe('what the analyser can open', () => {
  it('knows a path on the disk from an address on the server', () => {
    expect(isOnDisk('file:///takes/a.m4a')).toBe(true);
    expect(isOnDisk('/takes/a.m4a')).toBe(true);
    expect(isOnDisk('https://example.com/a.m4a')).toBe(false);
  });
});

describe('a take on the device', () => {
  it('is read where it is, and nothing is fetched or deleted', async () => {
    const copy = await localCopyOf('file:///takes/a.m4a');
    expect(copy?.path).toBe('/takes/a.m4a');
    expect(fs.downloadFile).not.toHaveBeenCalled();
    await copy?.release();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('is refused where the file is no longer there', async () => {
    // Which is what a reinstall leaves behind.
    fs.exists.mockResolvedValue(false);
    expect(await localCopyOf('file:///gone/a.m4a')).toBeNull();
  });
});

describe('a take only on the server', () => {
  it('is fetched to a scratch file first', async () => {
    const copy = await localCopyOf('https://example.com/a.m4a');
    expect(copy).not.toBeNull();
    expect(fs.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({ fromUrl: 'https://example.com/a.m4a' })
    );
    expect(copy!.path.startsWith('/tmp/')).toBe(true);
  });

  it('leaves no scratch file behind', async () => {
    const copy = await localCopyOf('https://example.com/a.m4a');
    await copy?.release();
    expect(fs.unlink).toHaveBeenCalledWith(copy!.path);
  });

  it('says nothing came back when the fetch failed', async () => {
    fs.downloadFile.mockReturnValue({
      promise: Promise.resolve({ statusCode: 404 })
    });
    expect(await localCopyOf('https://example.com/gone.m4a')).toBeNull();
    // And cleans up after itself even then.
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('says nothing came back when the fetch threw', async () => {
    fs.downloadFile.mockImplementation(() => {
      throw new Error('offline');
    });
    expect(await localCopyOf('https://example.com/a.m4a')).toBeNull();
  });
});
