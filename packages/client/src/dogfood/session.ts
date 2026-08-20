/**
 * The recording session: start, pause, resume, stop, and running out of time.
 *
 * Two things here are not obvious from the outside.
 *
 * Elapsed time excludes pauses. Thinking is free (INT-DOG-002), and — more
 * importantly — a trail offset and a transcript timestamp have to refer to the
 * same moment, which they only do if both ignore the gaps.
 *
 * Stopping and running out of time are the same operation (INV-DOG-003). A
 * recording that needs a second deliberate act to send is one that gets
 * forgotten, and words already spoken are worth the same either way.
 */
import { AudioRecorder, FileDirectory, FileFormat } from 'react-native-audio-api';

import { audioEngine } from '../audio/AudioEngine';
import { isBusy } from '../app/activity';
import { CLIP_CAP_MS, CLIP_SUBDIRECTORY, COUNTDOWN_AT_MS } from './config';
import { ScreenTrail } from './trail';
import { IDLE_SESSION, type ClipState, type RecordingSession } from './types';

type Clock = () => number;

/** What a finished session hands over. Uploading is somebody else's job. */
export type FinishedClip = {
  audioPath: string;
  durationMs: number;
  trail: ReturnType<ScreenTrail['entries']>;
};

export class DogfoodSession {
  private readonly trail = new ScreenTrail();
  private recorder: AudioRecorder | null = null;
  private state: ClipState = 'idle';
  private accumulatedMs = 0;
  private segmentStartedAt = 0;

  constructor(private readonly now: Clock = Date.now) {}

  /** Time actually recorded, excluding anything spent paused. */
  elapsedMs(): number {
    const live = this.state === 'recording' ? this.now() - this.segmentStartedAt : 0;
    return this.accumulatedMs + live;
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
      isCountingDown: remainingMs <= COUNTDOWN_AT_MS,
      canRecord: !isBusy()
    };
  }

  /**
   * Begin recording. Refused while a take holds the microphone — the device
   * serves one at a time and a take cannot be sung again (INV-DOG-001).
   */
  async start(route: string): Promise<boolean> {
    if (this.state !== 'idle' || isBusy()) {
      return false;
    }

    // Settle the permission first. Starting the recorder while iOS is still
    // asking fails, the state falls back to idle, and the control shows
    // nothing — which reads as a dead button rather than as a prompt being
    // answered.
    if (!(await audioEngine.requestPermission())) {
      return false;
    }

    const recorder = new AudioRecorder();
    // Speech, not pitch: the engine's Measurement mode disables the input
    // processing that makes a voice transcribable.
    recorder.enableFileOutput({
      format: FileFormat.M4A,
      directory: FileDirectory.Document,
      subDirectory: CLIP_SUBDIRECTORY,
      channelCount: 1
    });
    const started = await recorder.start();
    if (started.status === 'error') {
      return false;
    }
    this.recorder = recorder;
    this.state = 'recording';
    this.accumulatedMs = 0;
    this.segmentStartedAt = this.now();
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

  /** Hold, keeping what has been said. Time paused does not count. */
  pause(): void {
    if (this.state !== 'recording' || !this.recorder) {
      return;
    }
    this.accumulatedMs = this.elapsedMs();
    this.recorder.pause();
    this.state = 'paused';
  }

  /** Carry on into the same clip. */
  resume(route: string): void {
    if (this.state !== 'paused' || !this.recorder || isBusy()) {
      return;
    }
    this.recorder.resume();
    this.state = 'recording';
    this.segmentStartedAt = this.now();
    this.trail.visit(route, this.accumulatedMs);
  }

  /**
   * Finish. Used both by the stop control and by the cap elapsing, because
   * they mean the same thing (INV-DOG-003).
   *
   * Returns null for a clip with nothing in it — an accidental tap should not
   * produce something for the loop to read.
   */
  async stop(): Promise<FinishedClip | null> {
    if (this.state === 'idle' || !this.recorder) {
      return null;
    }
    const durationMs = this.elapsedMs();
    const result = await this.recorder.stop();
    const trail = this.trail.entries();
    this.recorder = null;
    this.state = 'idle';
    this.accumulatedMs = 0;
    this.trail.reset();

    const audioPath = result.status === 'success' ? result.paths[0] : undefined;
    if (!audioPath || durationMs <= 0) {
      return null;
    }
    return { audioPath, durationMs, trail };
  }
}
