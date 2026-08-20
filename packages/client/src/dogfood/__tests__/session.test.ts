/**
 * The recording session — INV-DOG-001 (singing wins) and INV-DOG-003
 * (stopping and running out of time are the same thing).
 */
import { audioEngine } from '../../audio/AudioEngine';
import { markBusy, resetBusyForTests } from '../../app/activity';

// The session asks the engine for the microphone before recording. Mocked
// here rather than globally: AudioEngine has its own tests needing the real
// module.
jest.mock('../../audio/AudioEngine', () => ({
  __esModule: true,
  audioEngine: { requestPermission: jest.fn(() => Promise.resolve(true)) }
}));

import { DogfoodSession } from '../session';
import { CLIP_CAP_MS, COUNTDOWN_AT_MS } from '../config';

/** A clock the test drives, so nothing waits on real time. */
const clockAt = (start: number) => {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
};

const permissionMock = jest.mocked(audioEngine.requestPermission);

beforeEach(() => {
  resetBusyForTests();
  permissionMock.mockReset().mockResolvedValue(true);
});

describe('DogfoodSession', () => {
  it('starts recording and opens the trail on the current screen', async () => {
    const session = new DogfoodSession(() => 1000);
    expect(await session.start('Notes')).toBe(true);
    expect(session.snapshot().state).toBe('recording');
  });

  it('INV-DOG-001: refuses to start while a capture holds the microphone', async () => {
    markBusy('capture');
    const session = new DogfoodSession(() => 1000);
    expect(await session.start('Notes')).toBe(false);
    expect(session.snapshot().state).toBe('idle');
  });

  it('INV-DOG-001: refuses during a practice session too', async () => {
    markBusy('practice session');
    const session = new DogfoodSession(() => 1000);
    expect(await session.start('Practice')).toBe(false);
  });

  it('ACC-DOG-004: becomes available again once the take ends', async () => {
    const done = markBusy('capture');
    const session = new DogfoodSession(() => 1000);
    expect(session.snapshot().canRecord).toBe(false);
    done();
    expect(session.snapshot().canRecord).toBe(true);
  });

  it('counts elapsed time while recording', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(5_000);
    expect(session.elapsedMs()).toBe(5_000);
  });

  it('ACC-DOG-005: time spent paused is free', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(30_000);
    session.pause();
    clock.advance(60_000);
    expect(session.elapsedMs()).toBe(30_000);
  });

  it('ACC-DOG-006: resuming continues the same clip', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(10_000);
    session.pause();
    clock.advance(60_000);
    session.resume('Dashboard');
    clock.advance(5_000);
    expect(session.elapsedMs()).toBe(15_000);
    expect(session.snapshot().state).toBe('recording');
  });

  it('ACC-DOG-007: the countdown stays hidden until the end is near', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(CLIP_CAP_MS - COUNTDOWN_AT_MS - 1_000);
    expect(session.snapshot().isCountingDown).toBe(false);
  });

  it('shows the countdown once the cap is close', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(CLIP_CAP_MS - 5_000);
    const view = session.snapshot();
    expect(view.isCountingDown).toBe(true);
    expect(view.remainingMs).toBe(5_000);
  });

  it('never reports negative time left', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(CLIP_CAP_MS + 30_000);
    expect(session.snapshot().remainingMs).toBe(0);
  });

  it('records navigation as context, not as an interruption', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(3_000);
    session.navigate('Practice');
    expect(session.snapshot().state).toBe('recording');
  });

  it('ACC-DOG-008: stopping produces a clip carrying its trail', async () => {
    const clock = clockAt(0);
    const session = new DogfoodSession(clock.now);
    await session.start('Notes');
    clock.advance(4_000);
    session.navigate('Practice');
    const clip = await session.stop();
    expect(clip?.durationMs).toBe(4_000);
    expect(clip?.trail.map((v) => v.route)).toEqual(['Notes', 'Practice']);
    expect(session.snapshot().state).toBe('idle');
  });

  it('discards a clip with nothing in it', async () => {
    const session = new DogfoodSession(() => 1000);
    await session.start('Notes');
    // No time advanced: an accidental tap should not reach the loop.
    expect(await session.stop()).toBeNull();
  });

  it('stopping when nothing is recording does nothing', async () => {
    const session = new DogfoodSession(() => 1000);
    expect(await session.stop()).toBeNull();
  });

  it('settles the microphone permission before starting', async () => {
    // The first tap on a fresh install raised the iOS prompt mid-start, the
    // recorder failed while it was still showing, and the control fell back
    // to idle — indistinguishable from a dead button.
    const session = new DogfoodSession(() => 1000);
    await session.start('Notes');
    expect(permissionMock).toHaveBeenCalled();
  });

  it('configures the session for speech before recording', async () => {
    // The recorder's engine cannot activate a session left configured for
    // pitch detection, and refuses outright — which is what stopped every
    // recording on the device.
    const { AudioManager } = jest.requireMock('react-native-audio-api') as {
      AudioManager: { setAudioSessionOptions: jest.Mock };
    };
    AudioManager.setAudioSessionOptions.mockClear();

    const session = new DogfoodSession(() => 1000);
    await session.start('Notes');

    expect(AudioManager.setAudioSessionOptions).toHaveBeenCalledWith(
      expect.objectContaining({ iosCategory: 'playAndRecord' })
    );
  });

  it('does not record when the permission is refused', async () => {
    permissionMock.mockResolvedValue(false);
    const session = new DogfoodSession(() => 1000);
    expect(await session.start('Notes')).toBe(false);
    expect(session.snapshot().state).toBe('idle');
  });
});
