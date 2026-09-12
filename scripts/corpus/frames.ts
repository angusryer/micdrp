/**
 * A recording as frames — through the device's own engine (INV-NOTES-261).
 *
 * The C++ PitchEngine is the only thing that analyses audio, on the phone
 * and here. It used to be the TypeScript reference on this side, which is
 * the same algorithm within 1e-4 Hz and not the same bits — and "within" is
 * not "exactly" when a take is compared with itself across a re-read. So
 * the samples go out to `dsp_frames`, built from the same sources the app
 * compiles, and the frames come back as the bridge would hand them to JS.
 *
 * Built on first use and rebuilt when any DSP source is newer than the
 * binary, into a directory git ignores. Every engine option defaults to the
 * engine's own default; only what a take carried is passed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { PitchFrame } from './logic.ts';

const REPO = new URL('../..', import.meta.url).pathname;
const DSP = join(REPO, 'packages/client/cpp/dsp');
const OUT = join(REPO, 'node_modules/.cache/micdrp-dsp');
const BINARY = join(OUT, 'frames');

const SOURCES = ['mpm.cpp', 'notes.cpp', 'ring_buffer.cpp', 'pitch_engine.cpp'];

/** The engine options a take may carry. Anything absent is the engine's own default. */
export interface FrameOptions {
  frameSize?: number;
  hopSize?: number;
  minFrequencyHz?: number;
  maxFrequencyHz?: number;
  clarityThreshold?: number;
}

function newestSourceMs(): number {
  const files = [
    ...SOURCES.map((f) => join(DSP, f)),
    join(DSP, 'tools/frames_cli.cpp'),
    ...readdirSync(DSP)
      .filter((f) => f.endsWith('.h'))
      .map((f) => join(DSP, f))
  ];
  return Math.max(...files.map((f) => statSync(f).mtimeMs));
}

/** The bench engine, compiled from the app's own DSP sources. */
export function ensureEngine(): string {
  const stale = !existsSync(BINARY) || statSync(BINARY).mtimeMs < newestSourceMs();
  if (stale) {
    mkdirSync(OUT, { recursive: true });
    execFileSync('c++', [
      '-std=c++17',
      '-O2',
      `-I${DSP}`,
      ...SOURCES.map((f) => join(DSP, f)),
      join(DSP, 'tools/frames_cli.cpp'),
      '-o',
      BINARY
    ]);
  }
  return BINARY;
}

const flag = (name: string, value: number | undefined): string[] =>
  value == null ? [] : [name, String(value)];

/** Run the device's engine across a recording, one window at a time. */
export function framesOf(
  samples: Float32Array,
  sampleRateHz: number,
  options: FrameOptions = {}
): PitchFrame[] {
  const engine = ensureEngine();
  const args = [
    '--rate',
    String(sampleRateHz),
    ...flag('--frame', options.frameSize),
    ...flag('--hop', options.hopSize),
    ...flag('--min-hz', options.minFrequencyHz),
    ...flag('--max-hz', options.maxFrequencyHz),
    ...flag('--clarity', options.clarityThreshold)
  ];
  // Little-endian float32, which is what the engine's buffers hold and what
  // every machine this runs on writes.
  const input = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const run = spawnSync(engine, args, { input, maxBuffer: 1 << 30 });
  if (run.status !== 0) {
    throw new Error(`dsp_frames failed: ${run.stderr?.toString() ?? run.status}`);
  }
  return run.stdout
    .toString('utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as PitchFrame);
}
