/**
 * Naming a remark without reading it for requests.
 *
 * Split from interpret.ts to stay inside the file budget. Used to backfill
 * clips read before titles existed: a full interpretation would cost a pass
 * over work already delivered, to produce something thrown away.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** A name for a remark: a few words naming its subject. */
export async function nameRemark(transcript: string): Promise<string> {
  const prompt =
    'Give this spoken remark a title: at most six words, naming what it is ' +
    'about rather than describing it. "Record button styling", not "The user ' +
    'would like the record button changed". Reply with the title alone — no ' +
    'quotes, no prose.\n\n' +
    transcript;

  try {
    const { stdout } = await run('claude', ['-p', prompt], {
      timeout: 2 * 60 * 1000,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim().replace(/^["']|["']$/g, '').slice(0, 60);
  } catch {
    // No name is better than a wrong one, and better than a failed backfill.
    return '';
  }
}
