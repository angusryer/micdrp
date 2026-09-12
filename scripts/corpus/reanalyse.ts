/**
 * Re-analyse every sample on this machine with no screen (INV-NOTES-259).
 *
 * From the audio, not from the frozen melody: the reader is what gets
 * better, so the reader is what runs. Each sample's recording is read into
 * frames, read with the thresholds the sample was read with (INV-NOTES-216),
 * and every layer above it derived through the same function the screen
 * uses. What the sample carried is printed beside what came out, so a
 * change to the reader is visible take by take.
 *
 *   yarn corpus reanalyse            # every sample under .samples/
 *
 * Read with the device's own engine, compiled for this machine from the
 * same sources (INV-NOTES-261): the frames here are the frames the phone
 * would produce, so a difference from what a sample carried is a difference
 * in the reader or its thresholds, never in the detector.
 *
 * A sample whose statements no longer anchor is reported rather than
 * silently dropped: that is exactly the regression this exists to catch.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { framesOf } from './frames.ts';
import { logic } from './logic.ts';
import { readWav } from './wav.ts';

type Statements = Parameters<typeof logic.derive>[1];

interface Sample {
  dir: string;
  title: string;
  durationMs: number;
  /** What the sample carried, for the comparison. */
  had: { notes: number; hits: number };
  readWith: Record<string, number>;
  statements: Statements;
}

function loadSamples(root: string): Sample[] {
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((dir) => statSync(dir).isDirectory())
    .flatMap((dir) => {
      try {
        const raw = JSON.parse(readFileSync(join(dir, 'reading.json'), 'utf8')) as Record<
          string,
          unknown
        >;
        const active = (raw.interpretations as { isFrozen?: boolean }[] | undefined)?.find(
          (i) => !i.isFrozen
        );
        return [
          {
            dir,
            title: String(raw.title ?? dir.split('/').pop()),
            durationMs: Number(raw.durationMs ?? 0),
            had: {
              notes: ((raw.melody as unknown[]) ?? []).length,
              hits: ((raw.hits as unknown[]) ?? []).length
            },
            readWith: (raw.readWith as Record<string, number>) ?? {},
            statements: (active ?? {}) as Statements
          }
        ];
      } catch {
        return [];
      }
    });
}

/** The engine settings a recipe names, so a sample is read the way it was. */
function engineFrom(readWith: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const [flat, value] of Object.entries(readWith)) {
    const [group, key] = flat.split('.');
    if (group === 'engine' && key) {
      out[key] = value;
    }
  }
  return out;
}

/** The options readTake takes, from the flat `group.key` map a take stores. */
function optionsFrom(readWith: Record<string, number>) {
  const groups: Record<string, Record<string, number>> = {};
  let minArticulationMs: number | undefined;
  for (const [flat, value] of Object.entries(readWith)) {
    const [group, key] = flat.split('.');
    if (group === 'top' && key === 'minArticulationMs') {
      minArticulationMs = value;
    } else if (group && key) {
      (groups[group] ??= {})[key] = value;
    }
  }
  return { ...groups, ...(minArticulationMs != null ? { minArticulationMs } : {}) };
}

/** How many of the kept statements still land on the derived layers. */
function landed(s: Statements, out: ReturnType<typeof logic.derive>): number {
  return (
    (s.notes ?? []).filter((e) => logic.noteAt(out.transcription.heard, e.atMs) !== -1).length +
    (s.writtenNotes?.length ?? 0) +
    (s.deletedNotes?.length ?? 0) +
    out.rhythm.beatLine.filter((b) => b.kind === 'tapped').length +
    (s.chords?.length ?? 0)
  );
}

const stated = (s: Statements): number =>
  (s.notes?.length ?? 0) +
  (s.writtenNotes?.length ?? 0) +
  (s.deletedNotes?.length ?? 0) +
  (s.beats?.length ?? 0) +
  (s.chords?.length ?? 0);

export function reanalyse(root = '.samples'): { derived: number; failed: number } {
  const samples = loadSamples(root);
  let failed = 0;
  console.log(
    ['sample', 'notes had→now', 'hits had→now', 'stated', 'landed', 'bpm', 'beats', 'bars', 'chords'].join(
      '\t'
    )
  );
  for (const s of samples) {
    try {
      const audio = readdirSync(s.dir).find((f) => f.startsWith('audio.'));
      if (audio == null) {
        throw new Error('no audio');
      }
      const { samples: pcm, sampleRateHz } = readWav(join(s.dir, audio));
      const frames = framesOf(pcm, sampleRateHz, engineFrom(s.readWith));
      const read = logic.readTake(frames, 'mixed', optionsFrom(s.readWith));
      const reading = { notes: logic.recentreNotes(read.notes).notes, hits: read.hits };
      const out = logic.derive(reading, s.statements, { durationMs: s.durationMs });
      const kept = landed(s.statements, out);
      const asked = stated(s.statements);
      console.log(
        [
          s.title.slice(0, 22),
          `${s.had.notes}→${out.transcription.notes.length}`,
          `${s.had.hits}→${reading.hits.length}`,
          asked,
          kept === asked ? String(kept) : `${kept} of ${asked} !`,
          Math.round(out.rhythm.grid.bpm),
          out.rhythm.beatLine.length,
          out.rhythm.bars.lines.length,
          out.harmony.slots.length
        ].join('\t')
      );
    } catch (error) {
      failed += 1;
      console.log(`${s.title.slice(0, 22)}\tFAILED\t${(error as Error).message}`);
    }
  }
  return { derived: samples.length - failed, failed };
}
