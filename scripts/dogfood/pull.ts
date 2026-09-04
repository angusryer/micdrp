/**
 * `yarn dogfood samples` — the command around the fetching.
 *
 * Prints one line per sample written, and nothing at all when there is
 * nothing new. Same manners as the loop: silence means nothing was
 * waiting, so a scheduled run does not fill a log with "no samples".
 *
 * Spec: .harnex/project/specs/domains/dogfood/commands.yml (CMD-DOG-007)
 */
import { isAbsolute, join, relative } from 'node:path';

import { connect, signIn } from './auth.ts';
import { listSamples, markPulled, writeSample } from './samples.ts';

const REPO = new URL('../..', import.meta.url).pathname;

/** Where the corpus goes by default. Ignored by git (INV-DOG-038). */
export const DEFAULT_OUT = '.samples';

export interface PullOptions {
  /** Fetch everything again, not only what has not been pulled. */
  all: boolean;
  out: string;
}

const seconds = (ms: number): string => `${Math.round(ms / 1000)}s`;

/**
 * Fetch every shared take that has not been fetched, and write each one
 * into its own directory beside the code.
 *
 * A sample is marked pulled only once its audio is actually on disk, so a
 * run that dies halfway leaves the rest to the next one rather than
 * claiming them and losing them.
 */
export async function pullSamples(options: PullOptions): Promise<number> {
  const pb = connect();
  await signIn(pb);

  const outDir = isAbsolute(options.out) ? options.out : join(REPO, options.out);
  const samples = await listSamples(pb, options.all);
  let written = 0;

  for (const sample of samples) {
    const pulled = await writeSample(pb, sample, outDir);
    if (pulled.problem != null) {
      // Said out loud and left unmarked, so a later run tries again once
      // whatever went wrong is fixed.
      console.error(`dogfood: ${sample.title} — ${pulled.problem}`);
      continue;
    }
    await markPulled(pb, sample.id);
    written += 1;
    console.log(
      `${pulled.title} — ${seconds(pulled.durationMs)}, ` +
        `${pulled.noteCount} notes → ${relative(REPO, pulled.dir)}`
    );
  }

  if (written > 0) {
    console.log(`dogfood: ${written} sample(s) in ${relative(REPO, outDir)}`);
  }
  return written;
}
