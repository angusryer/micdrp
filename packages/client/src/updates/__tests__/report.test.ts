/**
 * ACC-UPD-032..034 / INV-UPD-027 — a crash is reported against the bundle that
 * was running, quietly, and only where there is somewhere to report it.
 *
 * Bundles reach installed builds without review. A crash that cannot say which
 * publish it happened on cannot tell a fault in yesterday's bundle from a
 * fault in the binary, which is why the bundle is the assertion here.
 */
import Config from 'react-native-config';

import { reportCrash } from '../report';
import { runningBundle } from '../bundle';

jest.mock('../bundle', () => ({
  runningBundle: jest.fn(),
  embeddedBundle: jest.fn(() => 'embedded')
}));

const bundleMock = runningBundle as jest.MockedFunction<typeof runningBundle>;

/** The report the one fetch call carried. */
const sent = (fetchMock: jest.Mock): Record<string, unknown> => {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body) as Record<string, unknown>;
};

let fetchMock: jest.Mock;

beforeEach(() => {
  bundleMock.mockReset().mockReturnValue('bundle-A');
  fetchMock = jest.fn(() => Promise.resolve({ ok: true }));
  global.fetch = fetchMock as unknown as typeof fetch;
  Object.assign(Config, {
    OTA_UPDATE_URL: 'https://ota.example.com',
    OTA_CHANNEL: 'beta',
    VERSION_NUMBER: '1.0.0',
    BUILD_NUMBER: '55'
  });
});

it('ACC-UPD-032: a caught render crash names the bundle it happened on', async () => {
  await reportCrash(new TypeError('boom'), 'render', true);

  const [url] = fetchMock.mock.calls[0] as [string];
  expect(url).toBe('https://ota.example.com/crash');

  const body = sent(fetchMock);
  expect(body.bundleId).toBe('bundle-A');
  expect(body.origin).toBe('render');
  expect(body.survived).toBe(true);
  expect(body.name).toBe('TypeError');
  expect(body.message).toBe('boom');
  // And what binary it was, so a crash on old JavaScript is distinguishable.
  expect(body.appVersion).toBe('1.0.0');
  expect(body.buildNumber).toBe(55);
  expect(body.channel).toBe('beta');
});

it('ACC-UPD-032: the binary’s own bundle is reported as no bundle at all', async () => {
  bundleMock.mockReturnValue(null);
  await reportCrash(new Error('boom'), 'render', true);
  expect(sent(fetchMock).bundleId).toBeNull();
});

it('a fatal says so, so it is not read as a screen that recovered', async () => {
  await reportCrash(new Error('boom'), 'global', false);
  const body = sent(fetchMock);
  expect(body.origin).toBe('global');
  expect(body.survived).toBe(false);
});

it('ACC-UPD-033: an install with no update server performs no request', async () => {
  Object.assign(Config, { OTA_UPDATE_URL: '' });
  await reportCrash(new Error('boom'), 'render', true);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('ACC-UPD-034: a server that refuses changes nothing and throws nothing', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  await expect(reportCrash(new Error('boom'), 'render', true)).resolves.toBeUndefined();
});

it('a throw that is not an Error is still a row', async () => {
  await reportCrash('just a string', 'global', false);
  const body = sent(fetchMock);
  expect(body.name).toBe('Error');
  expect(body.message).toBe('just a string');
  expect(body.stack).toBe('');
});

it('a stack longer than the limit is cut rather than dropped', async () => {
  const error = new Error('boom');
  error.stack = 'x'.repeat(9000);
  await reportCrash(error, 'render', true);
  const stack = sent(fetchMock).stack as string;
  expect(stack.length).toBeLessThan(9000);
  expect(stack.endsWith('…')).toBe(true);
});
