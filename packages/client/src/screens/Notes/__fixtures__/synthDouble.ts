/**
 * One stand-in for the native engine, shared by the tests that need one.
 *
 * A module rather than a `const` in the test file: a `jest.mock` factory runs
 * before the test module's own bindings exist, so a double declared beside
 * the mock is undefined at the moment the mock is asked for it. Requiring
 * this from inside the factory has no such ordering.
 */
export const synthDouble: Record<string, jest.Mock> = {
  start: jest.fn(),
  stop: jest.fn(),
  nowMs: jest.fn(),
  setBusLevel: jest.fn(),
  schedule: jest.fn(),
  scheduleSamples: jest.fn(),
  loadSample: jest.fn(),
  unloadSample: jest.fn(),
  clearBus: jest.fn(),
  clearAll: jest.fn()
};

/** Back to a working engine that holds a one-minute take. */
export function resetSynthDouble(): void {
  for (const fn of Object.values(synthDouble)) {
    fn.mockReset();
  }
  synthDouble.start.mockResolvedValue(undefined);
  synthDouble.nowMs.mockReturnValue(10_000);
  synthDouble.loadSample.mockResolvedValue(60_000);
}
