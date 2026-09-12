/**
 * `yarn corpus` — run the app's reading over the shared takes on disk.
 *
 * The loop the corpus was built for: change a detector, run this, see
 * whether real recordings of a real voice got better or worse. No device,
 * no build, no listening.
 *
 * Spec: .harnex/project/specs/domains/pitch/commands.yml
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { readWav } from './wav.ts';
import { framesOf } from './frames.ts';
import { appReading, whatItWas } from './pipelines.ts';
import { reanalyse } from './reanalyse.ts';
import { score, type Score } from './score.ts';

const REPO = new URL('../..', import.meta.url).pathname;
const argv = process.argv.slice(2);
const valueOf = (flag: string, fallback: string): string => {
  const at = argv.indexOf(flag);
  return at >= 0 ? (argv[at + 1] ?? fallback) : fallback;
};

const dir = join(REPO, valueOf('--samples', '.samples'));
// The engine's own default unless asked otherwise; the corpus does not keep
// a second copy of a number the engine already decides (Axiom 2).
const ceilingArg = valueOf('--max-hz', '');
const ceiling = ceilingArg === '' ? null : Number(ceilingArg);

/**
 * The ceiling the reference frames are detected at.
 *
 * Scoring a reading against frames from its own ceiling flatters every
 * ceiling equally: lower the ceiling and the frames it is judged against
 * lose exactly the singing it stopped hearing, so coverage barely moves
 * while half the take goes missing. It read as 87% at 1200 Hz and 84% at
 * 2500, which is the wrong way round. One fixed reference, high enough to
 * hold everything anyone whistles, makes the number mean something across
 * a sweep.
 */
const REFERENCE_HZ = 3500;

const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;
const row = (name: string, s: Score): string =>
  `    ${name.padEnd(9)} ${String(s.notes).padStart(3)} notes  ` +
  `covered ${pct(s.coverage).padStart(4)}  ` +
  `accurate ${pct(s.accurate).padStart(4)}  ` +
  `median ${s.medianError >= 0 ? '+' : ''}${s.medianError.toFixed(2)} st`;

if (!existsSync(dir)) {
  console.error(`corpus: nothing at ${dir} — run 'yarn dogfood samples' first`);
  process.exit(1);
}

const samples = readdirSync(dir).filter((name) =>
  existsSync(join(dir, name, 'reading.json'))
);
if (samples.length === 0) {
  console.error(`corpus: no samples in ${dir}`);
  process.exit(1);
}

// Re-derive every sample with no screen and stop (INV-NOTES-259). A
// separate command from scoring because it asks a different question: not
// how well the reader heard, but whether every layer above it still comes
// out and every statement still lands.
if (process.argv.includes('reanalyse')) {
  const { derived, failed } = reanalyse(dir);
  console.log(`\n${derived} derived, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

console.log(`corpus: ${samples.length} sample(s), ceiling ${ceiling ?? 'engine default'} Hz\n`);
for (const name of samples) {
  const at = join(dir, name);
  const audio = readdirSync(at).find((f) => f.startsWith('audio.'));
  if (audio == null) {
    console.log(`  ${name}\n    (no audio)`);
    continue;
  }
  const { samples: pcm, sampleRateHz } = readWav(join(at, audio));
  const frames = framesOf(
    pcm,
    sampleRateHz,
    ceiling == null ? {} : { maxFrequencyHz: ceiling }
  );
  const reference =
    ceiling === REFERENCE_HZ
      ? frames
      : framesOf(pcm, sampleRateHz, { maxFrequencyHz: REFERENCE_HZ });
  console.log(`  ${name}`);
  console.log(row('now', score(appReading(frames), reference)));
  console.log(row('was', score(whatItWas(frames), reference)));
}
