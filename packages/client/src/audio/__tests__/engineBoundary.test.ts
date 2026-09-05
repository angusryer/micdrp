/**
 * ACC-TPORT-019 / INV-TPORT-024 — only the audio layer speaks to the engine.
 *
 * Six modules imported `NativeSynth` directly, three of them UI hooks in
 * `screens/Notes/` calling `clearBus`, `clearAll`, `setBusLevel`,
 * `setBusWave`, `unloadSample` and `scheduleSamples`. Each read as
 * reasonable alone; together they meant "what silenced the take?" had six
 * possible answers and no single place to look.
 *
 * A structural test rather than a behavioural one, because the fault is
 * structural: nothing a screen does with the engine is wrong on its own,
 * and no run of the app can show you that six places do it.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..');

/** Where the boundary is allowed to be crossed. */
const AUDIO_LAYER = 'audio';

/**
 * The import, not the identifier.
 *
 * `NativeSyntheticEvent` contains the letters of `NativeSynth`, and
 * matching the name alone reports every scroll handler in the app as an
 * audio caller — which it did, the first time this was looked for by hand.
 */
const IMPORTS_ENGINE = /from\s+'[^']*\/specs\/NativeSynth'/;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__fixtures__') {
        sourceFiles(full, found);
      }
    } else if (/\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

describe('the native audio boundary', () => {
  it('ACC-TPORT-019: is crossed only from src/audio', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => IMPORTS_ENGINE.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
      // The spec module is the declaration of the boundary, not a crossing.
      .filter((file) => !file.startsWith(join('specs', '')))
      .filter((file) => !file.startsWith(AUDIO_LAYER + '/'));

    expect(offenders).toEqual([]);
  });

  it('finds the importers it is meant to be checking', () => {
    // A test that greps for something and finds nothing anywhere passes
    // whether or not the rule holds. This one asserts the search works.
    const importers = sourceFiles(SRC).filter((file) =>
      IMPORTS_ENGINE.test(readFileSync(file, 'utf8'))
    );
    expect(importers.length).toBeGreaterThan(1);
  });
});
