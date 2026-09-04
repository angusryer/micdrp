/**
 * Reading a corpus sample's audio, with no device and no native code.
 *
 * Samples are written by `yarn dogfood samples` as 16-bit PCM WAV, which
 * is the one audio format worth being able to open here: the point of the
 * corpus is running the app's own reading over real recordings on this
 * machine, and a decoder dependency would put that behind an install.
 */
import { readFileSync } from 'node:fs';

export interface Pcm {
  samples: Float32Array;
  sampleRateHz: number;
}

/** Read a mono 16-bit PCM WAV. Throws on anything else, rather than guessing. */
export function readWav(path: string): Pcm {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path} is not a WAV file`);
  }

  let at = 12;
  let sampleRateHz = 0;
  let channels = 1;
  let bits = 16;
  let data: Buffer | null = null;

  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRateHz = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      data = buf.subarray(body, body + size);
    }
    // Chunks are word-aligned, so an odd size carries a pad byte.
    at = body + size + (size % 2);
  }

  if (data == null || sampleRateHz === 0) {
    throw new Error(`${path} has no readable audio`);
  }
  if (bits !== 16) {
    throw new Error(`${path} is ${bits}-bit; only 16-bit PCM is read here`);
  }

  const frames = Math.floor(data.length / 2 / channels);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    // Mixed down rather than refused: a take is mono in practice, and
    // averaging is the honest thing to do if one ever is not.
    let sum = 0;
    for (let c = 0; c < channels; c += 1) {
      sum += data.readInt16LE((i * channels + c) * 2);
    }
    samples[i] = sum / channels / 32768;
  }
  return { samples, sampleRateHz };
}
