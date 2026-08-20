/**
 * INV-DOG-014 — the control is somewhere it can actually be pressed.
 *
 * The control now lives in the header, so it unmounts on every navigation.
 * That is only safe because the session lives outside it. This pins the half
 * that makes header placement possible; without it, walking to another screen
 * would silently end the clip.
 */
import { resetBusyForTests } from '../../app/activity';
import { activeSession, resetActiveSessionForTests } from '../activeSession';

// The session asks the engine for the microphone before recording. Mocked
// here rather than globally: AudioEngine has its own tests that need the real
// module.
jest.mock('../../audio/AudioEngine', () => ({
  __esModule: true,
  audioEngine: { requestPermission: jest.fn(() => Promise.resolve(true)) }
}));


beforeEach(() => {
  resetBusyForTests();
  resetActiveSessionForTests();
});

describe('activeSession', () => {
  it('is the same session across separate lookups', () => {
    // Each header remount calls this afresh; they must all get one session.
    expect(activeSession()).toBe(activeSession());
  });

  it('ACC-DOG-029: a recording outlives the control that started it', async () => {
    await activeSession().start('Notes');

    // The control unmounts and remounts — what a navigation does.
    const afterNavigating = activeSession();

    expect(afterNavigating.snapshot().state).toBe('recording');
  });

  it('keeps the trail across that remount', async () => {
    // Real time is used here, so the clock is driven forward: a clip of zero
    // length is deliberately discarded, and start/stop in the same
    // millisecond would produce exactly that.
    const realNow = Date.now;
    let now = realNow();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    await activeSession().start('Notes');
    now += 4_000;
    activeSession().navigate('Practice');

    const clip = await activeSession().stop();

    expect(clip?.trail.map((v) => v.route)).toEqual(['Notes', 'Practice']);
    jest.mocked(Date.now).mockRestore();
  });
});
