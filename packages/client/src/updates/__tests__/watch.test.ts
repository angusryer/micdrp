/**
 * INV-UPD-027 at the global handler — the crashes no boundary sees.
 *
 * The one that matters is chaining: the handler already installed is what
 * shows the red box in development and ends the process in release, and
 * replacing it would trade a crash we can see for a crash we have hidden.
 */
import { resetWatchForTests, watchForCrashes } from '../watch';
import { reportCrash } from '../report';

jest.mock('../report', () => ({ reportCrash: jest.fn(() => Promise.resolve()) }));

const reportMock = reportCrash as jest.MockedFunction<typeof reportCrash>;

type Handler = (error: unknown, isFatal?: boolean) => void;

let previous: jest.Mock;
let installed: Handler | undefined;

beforeEach(() => {
  resetWatchForTests();
  reportMock.mockClear();
  previous = jest.fn();
  installed = previous as unknown as Handler;
  (globalThis as Record<string, unknown>).ErrorUtils = {
    getGlobalHandler: () => installed,
    setGlobalHandler: (handler: Handler) => {
      installed = handler;
    }
  };
});

it('reports a fatal, and still lets the app do what it was going to', () => {
  watchForCrashes();
  const error = new Error('boom');
  installed?.(error, true);

  expect(reportMock).toHaveBeenCalledWith(error, 'global', false);
  // The red box in development, the end of the process in release.
  expect(previous).toHaveBeenCalledWith(error, true);
});

it('a non-fatal is reported as survived', () => {
  watchForCrashes();
  installed?.(new Error('boom'), false);
  expect(reportMock).toHaveBeenCalledWith(expect.any(Error), 'global', true);
});

it('a second call does not wrap the handler around itself', () => {
  watchForCrashes();
  const afterFirst = installed;
  watchForCrashes();
  expect(installed).toBe(afterFirst);
});

it('an environment with no ErrorUtils is left alone', () => {
  delete (globalThis as Record<string, unknown>).ErrorUtils;
  expect(() => watchForCrashes()).not.toThrow();
});
