/**
 * Turning a clip into text, locally.
 *
 * Local and free was the point: these are unfiltered notes about unreleased
 * work, recorded in the maintainer's own voice, and there is no reason for
 * them to leave the machine. whisper.cpp does that, and the model Superwhisper
 * already downloaded can be reused rather than fetched again.
 *
 * Superwhisper itself is not driven here despite being the obvious candidate.
 * It transcribes what you dictate into the Mac's microphone; it has no
 * documented entry point for transcribing an arbitrary file, and the agent
 * inbox that looks like one is undocumented. An unattended loop that depends
 * on another app's internals breaks silently when that app updates.
 *
 * Spec: dogfood.transcribe_clip, INV-DOG-013 (transcribe once).
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Models to try, best first.
 *
 * Our own copy comes first deliberately. Reading the original out of
 * Superwhisper's Application Support container makes macOS raise a TCC
 * consent prompt — "node wants to access data from other apps" — which has to
 * be clicked. A prompt nobody is there to answer stops an unattended run
 * dead, so the model is copied somewhere this project owns and the other
 * app's copy is only a fallback for a machine that has not done that yet.
 */
const MODEL_CANDIDATES = [
  join(homedir(), '.cache/whisper/ggml-small.en.bin'),
  join(homedir(), 'Library/Application Support/superwhisper/ggml-small.en.bin')
];

export function findModel(): string | null {
  return MODEL_CANDIDATES.find(existsSync) ?? null;
}

/**
 * whisper.cpp wants 16 kHz mono PCM; the clip arrives as m4a from the phone.
 * ffmpeg is already a dependency of this machine's toolchain.
 */
async function toWav(audioPath: string): Promise<string> {
  const wav = join(tmpdir(), `dogfood-${Date.now()}.wav`);
  await run('ffmpeg', ['-y', '-i', audioPath, '-ar', '16000', '-ac', '1', wav]);
  return wav;
}

export interface Transcript {
  text: string;
  /** Absent when the recogniser does not report one. */
  confidence: number | null;
}

/**
 * Transcribe one clip.
 *
 * Throws rather than returning empty on failure: the caller leaves the clip
 * claimable so the next run tries again, which is better than storing an
 * empty transcript that would never be retried (INV-DOG-013 would then treat
 * it as done).
 */
export async function transcribe(audioPath: string): Promise<Transcript> {
  const model = findModel();
  if (!model) {
    throw new Error(
      'No local whisper model found. Install one with `brew install whisper-cpp` ' +
        'and place a ggml model at ~/.cache/whisper/ggml-small.en.bin'
    );
  }

  const wav = await toWav(audioPath);
  try {
    const out = join(tmpdir(), `dogfood-${Date.now()}`);
    await run('whisper-cli', [
      '-m', model,
      '-f', wav,
      '--output-json',
      '--output-file', out,
      '--no-prints'
    ]);
    const raw = JSON.parse(await readFile(`${out}.json`, 'utf8')) as {
      transcription?: { text: string }[];
    };
    await unlink(`${out}.json`).catch(() => undefined);

    const text = (raw.transcription ?? [])
      .map((segment) => segment.text)
      .join('')
      .trim();
    if (!text) {
      throw new Error('Transcription produced no text');
    }
    // whisper.cpp reports no overall confidence. Null says so rather than
    // inventing a number the gate would then trust.
    return { text, confidence: null };
  } finally {
    await unlink(wav).catch(() => undefined);
  }
}
