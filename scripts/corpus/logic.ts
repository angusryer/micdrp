/**
 * The app's own reading code, loaded into a plain Node process.
 *
 * `packages/logic` imports without file extensions, for Metro. Node's ESM
 * loader will not resolve that and its CommonJS loader will, so the
 * harness builds the package to CommonJS and requires the result — while
 * taking every type from the source, so this stays as checked as the app.
 *
 * One module does the loading, so the rest of the harness reads as if it
 * had imported the package directly.
 */
import { createRequire } from 'node:module';

import type {
  MpmOptions,
  NoteEvent,
  PitchFrame,
  PitchResult,
  ReadOptions,
  Reading,
  TakeRole,
  TuningCentre
} from '../../packages/logic/src/index.ts';

interface Logic {
  detectPitch(
    samples: Float32Array,
    sampleRate: number,
    options?: MpmOptions
  ): PitchResult;
  smoothPitch(frames: PitchFrame[], options?: Record<string, number>): PitchFrame[];
  segmentNotes(
    frames: readonly PitchFrame[],
    options?: Record<string, number>
  ): NoteEvent[];
  mergeBends(notes: readonly NoteEvent[], options?: Record<string, number>): NoteEvent[];
  dropTooBriefToSing(notes: readonly NoteEvent[], minMs?: number): NoteEvent[];
  recentreNotes(notes: readonly NoteEvent[]): {
    notes: NoteEvent[];
    centre: TuningCentre;
  };
  readTake(
    frames: readonly PitchFrame[],
    role: TakeRole,
    options?: ReadOptions
  ): Reading;
}

const built = new URL('../../packages/logic/dist/index.js', import.meta.url).pathname;

export const logic: Logic = createRequire(import.meta.url)(built) as Logic;
export type { NoteEvent, PitchFrame, ReadOptions };
