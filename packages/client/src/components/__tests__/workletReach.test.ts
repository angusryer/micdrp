/**
 * INV-NOTES-207 — everything the UI thread reaches is a worklet, transitively.
 *
 * A worklet that calls plain JavaScript does not throw. It takes the process
 * down, with no error, no report and nothing in a log — so the first thing to
 * notice has twice been a device, and both times the thing being opened was a
 * note. Running a worklet cannot be tested here. Reading one can.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';

import {
  calledNames,
  declaredFunctions,
  workletBodies
} from '../workletReach';

const CLIENT_SRC = resolve(__dirname, '../..');

/**
 * The analyser itself, which carries the directive as a string to look for.
 *
 * A tool that reads worklets is not one, and the alternative — spelling the
 * directive in pieces so it cannot be seen — would hide it from the very
 * search this exists to make possible.
 */
const READS_WORKLETS = 'components/workletReach.ts';

/** Every source file under the client, tests excluded. */
function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__fixtures__') {
        sources(path, found);
      }
    } else if (/\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

/** Where a name was imported from, for the files that re-export arithmetic. */
function relativeImports(source: string): Map<string, string> {
  const from = new Map<string, string>();
  for (const line of source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*'(\.[^']*)'/g
  )) {
    for (const raw of line[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && !name.startsWith('type ')) {
        from.set(name, line[2]);
      }
    }
  }
  return from;
}

/** Resolve a relative import to a file that exists. */
function fileFor(fromFile: string, spec: string): string | null {
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const path = resolve(dirname(fromFile), spec) + ext;
    try {
      statSync(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

it('INV-NOTES-207: nothing a worklet calls is plain JavaScript', () => {
  const reaching: string[] = [];

  for (const file of sources(CLIENT_SRC)) {
    const shown = file.slice(CLIENT_SRC.length + 1);
    if (shown === READS_WORKLETS) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (!source.includes("'worklet';")) {
      continue;
    }
    const here = declaredFunctions(source);
    const imported = relativeImports(source);

    for (const body of workletBodies(source)) {
      for (const name of calledNames(body)) {
        if (here.has(name)) {
          if (!here.get(name)) {
            reaching.push(`${shown}: worklet reaches \`${name}\``);
          }
          continue;
        }
        const spec = imported.get(name);
        const target = spec == null ? null : fileFor(file, spec);
        if (target != null) {
          const over = declaredFunctions(readFileSync(target, 'utf8'));
          if (over.has(name) && !over.get(name)) {
            reaching.push(`${shown}: worklet reaches \`${name}\` in ${spec}`);
          }
        }
      }
    }
  }

  expect([...new Set(reaching)].sort()).toEqual([]);
});
