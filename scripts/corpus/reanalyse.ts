/**
 * Re-analyse every sample on this machine with no screen (INV-NOTES-259).
 *
 * A reader that gets better is worth nothing if the takes it could improve
 * have to be visited one at a time. This reads each sample's kept reading
 * and statements, derives every layer through the same function the screen
 * uses, and reports what came out — so a change to any inference can be
 * measured against every take at once.
 *
 *   yarn corpus reanalyse            # every sample under .samples/
 *
 * A sample whose statements no longer anchor is reported rather than
 * silently dropped: that is exactly the regression this exists to catch.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { logic } from './logic.ts';

interface Sample {
  dir: string;
  title: string;
  durationMs: number;
  notes: Parameters<typeof logic.derive>[0]['notes'];
  hits: NonNullable<Parameters<typeof logic.derive>[0]['hits']>;
  statements: Parameters<typeof logic.derive>[1];
}

function loadSamples(root: string): Sample[] {
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((dir) => statSync(dir).isDirectory())
    .flatMap((dir) => {
      const path = join(dir, 'reading.json');
      try {
        const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        const active = (raw.interpretations as { isFrozen?: boolean }[] | undefined)?.find(
          (i) => !i.isFrozen
        );
        return [
          {
            dir,
            title: String(raw.title ?? name(dir)),
            durationMs: Number(raw.durationMs ?? 0),
            notes: (raw.melody ?? []) as Sample['notes'],
            hits: (raw.hits ?? []) as Sample['hits'],
            statements: (active ?? {}) as Sample['statements']
          }
        ];
      } catch {
        return [];
      }
    });
}

const name = (dir: string): string => dir.split('/').pop() ?? dir;

/** How many statements were kept, so a re-derivation that lost one shows. */
function statementCount(s: Sample['statements']): number {
  return (
    (s.notes?.length ?? 0) +
    (s.writtenNotes?.length ?? 0) +
    (s.deletedNotes?.length ?? 0) +
    (s.beats?.length ?? 0) +
    (s.chords?.length ?? 0)
  );
}

export function reanalyse(root = '.samples'): { derived: number; failed: number } {
  const samples = loadSamples(root);
  let failed = 0;
  console.log(
    ['sample', 'notes', 'stated', 'kept', 'bpm', 'beats', 'bars', 'chords'].join('\t')
  );
  for (const s of samples) {
    try {
      const out = logic.derive(
        { notes: s.notes, hits: s.hits },
        s.statements,
        { durationMs: s.durationMs }
      );
      const kept =
        (s.statements.notes ?? []).filter((e) =>
          out.transcription.heard.some((n) => e.atMs >= n.startMs && e.atMs < n.endMs)
        ).length +
        (s.statements.writtenNotes?.length ?? 0) +
        (s.statements.deletedNotes?.length ?? 0) +
        out.rhythm.beatLine.filter((b) => b.kind === 'tapped').length +
        (s.statements.chords?.length ?? 0);
      const stated = statementCount(s.statements);
      console.log(
        [
          s.title.slice(0, 24),
          out.transcription.notes.length,
          stated,
          kept === stated ? String(kept) : `${kept} of ${stated} !`,
          Math.round(out.rhythm.grid.bpm),
          out.rhythm.beatLine.length,
          out.rhythm.bars.lines.length,
          out.harmony.slots.length
        ].join('\t')
      );
    } catch (error) {
      failed += 1;
      console.log(`${s.title.slice(0, 24)}\tFAILED\t${(error as Error).message}`);
    }
  }
  return { derived: samples.length - failed, failed };
}
