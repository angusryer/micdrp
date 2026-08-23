/**
 * The recording session: start, stop, and running out of time. There is no
 * pause — a remark is spoken in one go, and a hold that has to be released is
 * one more thing to get wrong mid-sentence. It also keeps a trail offset and a
 * transcript timestamp referring to the same moment for free: with no gaps to
 * discount, elapsed time is simply wall time since the tap.
 *
 * Stopping and running out of time are the same operation (INV-DOG-003). A
 * recording that needs a second deliberate act to send is one that gets
 * forgotten, and words already spoken are worth the same either way.
 */
import {
  AudioManager,
  AudioRecorder,
  FileDirectory,
  FileFormat
} from 'react-native-audio-api';

import { audioEngine } from '../audio/AudioEngine';
import { isBusy } from '../app/activity';
import {
  CAUTION_AT_MS,
  CLIP_CAP_MS,
  CLIP_SUBDIRECTORY,
  WARNING_AT_MS
} from './config';
import { ScreenTrail } from './trail';
import {
  IDLE_SESSION,
  type ClipState,
  type CountdownUrgency,
  type RecordingSession
} from './types';

type Clock = () => number;

/** Which colour the countdown wears, from how little is left of the cap. */
const urgencyOf = (remainingMs: number): CountdownUrgency => {
  if (remainingMs <= WARNING_AT_MS) {
    return 'warning';
  }
  return remainingMs <= CAUTION_AT_MS ? 'caution' : 'none';
};

/** What a finished session hands over. Uploading is somebody else's job. */
export type FinishedClip = {
  audioPath: string;
  durationMs: number;
  trail: ReturnType<ScreenTrail['entries']>;
};

/**
 * Why the last attempt to start recording failed.
 *
 * A refused start currently shows nothing at all: the control returns to idle
 * and looks like a dead button. Settings reads this so the reason is visible
 * on the device.
 */
let lastStartError: string | null = null;

export function lastRecordingError(): string | null {
  return lastStartError;
}

export class DogfoodSession {
  private readonly trail = new ScreenTrail();
  private recorder: AudioRecorder | null = null;
  private state: ClipState = 'idle';
  private startedAt = 0;

  constructor(private readonly now: Clock = Date.now) {}

  /** Time recorded, counted from the tap that started the clip. */
  elapsedMs(): number {
    return this.state === 'recording' ? this.now() - this.startedAt : 0;
  }

  /** What the control renders. */
  snapshot(): RecordingSession {
    if (this.state === 'idle') {
      return { ...IDLE_SESSION, canRecord: !isBusy() };
    }
    const elapsedMs = this.elapsedMs();
    const remainingMs = Math.max(0, CLIP_CAP_MS - elapsedMs);
    return {
      state: this.state,
      elapsedMs,
      remainingMs,
      urgency: urgencyOf(remainingMs),
      canRecord: !isBusy()
    };
  }

  /**
   * Begin recording. Refused while a take holds the microphone — the device
   * serves one at a time and a take cannot be sung again (INV-DOG-001).
   */
  async start(route: string): Promise<boolean> {
    if (this.state !== 'idle') {
      lastStartError = `already ${this.state}`;
      return false;
    }
    if (isBusy()) {
      lastStartError = 'microphone busy with a take';
      return false;
    }

    // Settle the permission first. Starting the recorder while iOS is still
    // asking fails, the state falls back to idle, and the control shows
    // nothing — which reads as a dead button rather than as a prompt being
    // answered.
    try {
      if (!(await audioEngine.requestPermission())) {
        lastStartError = 'microphone permission refused';
        return false;
      }
    } catch (error) {
      lastStartError = `permission check failed: ${String(error)}`;
      return false;
    }

    // Configure the session for recording speech before starting anything.
    // Without this the recorder's engine cannot activate the session at all
    // and refuses with "failed to start audio engine for recording" — the
    // session is shared, and micdrp's own engine leaves it configured for
    // pitch detection, which is a different job.
    //
    // voiceChat rather than measurement: measurement disables the input
    // processing that makes speech transcribable, which is right for
    // detecting pitch and wrong for understanding words.
    try {
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'voiceChat',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP']
      });
      await AudioManager.setAudioSessionActivity(true);
    } catch (error) {
      lastStartError = `audio session refused: ${String(error)}`;
      return false;
    }

    const recorder = new AudioRecorder();
    recorder.enableFileOutput({
      format: FileFormat.M4A,
      directory: FileDirectory.Document,
      subDirectory: CLIP_SUBDIRECTORY,
      channelCount: 1
    });
    let started;
    try {
      started = await recorder.start();
    } catch (error) {
      lastStartError = `recorder threw: ${String(error)}`;
      return false;
    }
    if (started.status === 'error') {
      lastStartError = `recorder refused: ${started.message}`;
      return false;
    }
    lastStartError = null;
    this.recorder = recorder;
    this.state = 'recording';
    this.startedAt = this.now();
    this.trail.reset();
    this.trail.visit(route, 0);
    return true;
  }

  /** Note that the maintainer moved somewhere else mid-sentence. */
  navigate(route: string): void {
    if (this.state === 'idle') {
      return;
    }
    this.trail.visit(route, this.elapsedMs());
  }

  /**
   * Finish. Used both by the tap on the square and by the cap elapsing,
   * because they mean the same thing (INV-DOG-003).
   *
   * Returns null for a clip with nothing in it — an accidental tap should not
   * produce something for the loop to read.
   */
  async stop(): Promise<FinishedClip | null> {
    if (this.state === 'idle' || !this.recorder) {
      return null;
    }
    const durationMs = this.elapsedMs();

    // A throw here loses the clip silently: the caller is fire-and-forget, so
    // the rejection goes nowhere, the queue stays empty, and nothing is
    // recorded to explain it. Only the `status: 'error'` case was handled.
    let result;
    try {
      result = await this.recorder.stop();
    } catch (error) {
      lastStartError = `stop threw: ${String(error)}`;
      this.recorder = null;
      this.state = 'idle';
      this.trail.reset();
      return null;
    }

    const trail = this.trail.entries();
    this.recorder = null;
    this.state = 'idle';
    this.trail.reset();

    const audioPath = result.status === 'success' ? result.paths[0] : undefined;
    if (!audioPath) {
      lastStartError =
        result.status === 'error'
          ? `stop failed: ${result.message}`
          : 'stop produced no file';
      return null;
    }
    if (durationMs <= 0) {
      lastStartError = 'clip had no duration';
      return null;
    }
    return { audioPath, durationMs, trail };
  }
}
