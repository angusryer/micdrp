/**
 * INV-UPD-027 — reading a crash report off the wire without trusting it.
 *
 * The rule that matters is that nothing is ever rejected. A report is
 * diagnostic; refusing a malformed one loses the only evidence there was, and
 * a row of empty strings still says a build crashed.
 */
import {
  CRASH_MESSAGE_LIMIT,
  CRASH_STACK_LIMIT,
  toCrashReport
} from '../dto/crashReport';

const good = {
  channel: 'beta',
  appVersion: '1.0.0',
  buildNumber: 55,
  bundleId: 'bundle-A',
  origin: 'render',
  survived: true,
  name: 'TypeError',
  message: 'boom',
  stack: 'at x'
};

it('reads a well-formed report as it was sent', () => {
  expect(toCrashReport(good)).toEqual(good);
});

it('keeps a report with nothing in it, rather than refusing it', () => {
  expect(toCrashReport({})).toEqual({
    channel: '',
    appVersion: '',
    buildNumber: 0,
    bundleId: null,
    origin: 'render',
    survived: true,
    name: '',
    message: '',
    stack: ''
  });
  expect(() => toCrashReport(null)).not.toThrow();
  expect(() => toCrashReport('nonsense')).not.toThrow();
});

it('the binary’s own bundle and a missing one are both no bundle', () => {
  expect(toCrashReport({ ...good, bundleId: null }).bundleId).toBeNull();
  expect(toCrashReport({ ...good, bundleId: '' }).bundleId).toBeNull();
  expect(toCrashReport({ ...good, bundleId: 7 }).bundleId).toBeNull();
});

it('an unknown origin is read as a render, never invented', () => {
  expect(toCrashReport({ ...good, origin: 'sideways' }).origin).toBe('render');
  expect(toCrashReport({ ...good, origin: 'global' }).origin).toBe('global');
});

it('survived unless it says otherwise', () => {
  expect(toCrashReport({ ...good, survived: undefined }).survived).toBe(true);
  expect(toCrashReport({ ...good, survived: false }).survived).toBe(false);
});

it('a build number that is not a number is zero, not a crash', () => {
  expect(toCrashReport({ ...good, buildNumber: 'fifty' }).buildNumber).toBe(0);
  expect(toCrashReport({ ...good, buildNumber: null }).buildNumber).toBe(0);
});

it('an oversized stack is cut, and says it was cut', () => {
  const report = toCrashReport({ ...good, stack: 'x'.repeat(CRASH_STACK_LIMIT * 2) });
  expect(report.stack).toHaveLength(CRASH_STACK_LIMIT + 1);
  expect(report.stack.endsWith('…')).toBe(true);
});

it('an oversized message is cut too', () => {
  const report = toCrashReport({ ...good, message: 'x'.repeat(CRASH_MESSAGE_LIMIT * 2) });
  expect(report.message).toHaveLength(CRASH_MESSAGE_LIMIT + 1);
});
