import App from '../App';

/**
 * Smoke test only: the full app tree pulls in navigation + reanimated + skia +
 * the native audio engine, which are not exercisable under Jest without a
 * device. We assert the module wires up; behavioural coverage lives in the
 * per-screen and per-hook tests.
 */
it('exports an App component', () => {
  expect(typeof App).toBe('function');
});
