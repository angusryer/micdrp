/**
 * INV-NOTES-214 — a sheet that dims what is behind it is offered one height.
 *
 * The options sheet offered two: its content height and nine tenths of the
 * screen. The background went to a scaled-back state and stayed there, frozen
 * part-way and ignoring the grab handle, until the sheet was dismissed
 * outright. The glyph guide dims, offers one height, and animates correctly;
 * the analysis and selection sheets offer two heights and are undimmed, so
 * they have no background transition to get wrong.
 *
 * A structural test, because the fault is structural: nothing about any one
 * sheet is wrong on its own, and no run of the app shows you that the two
 * settings disagree. It reads the sources rather than rendering, for the same
 * reason the engine-boundary test does — a native animation is not something
 * a renderer here can play.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SHEETS_IN = join(__dirname, '..', '..', 'screens', 'Notes');

/** Every component that presents a Sheet of its own. */
const sheetSources = (): { file: string; source: string }[] =>
  readdirSync(SHEETS_IN)
    .filter((name) => /Sheet\.tsx$|Page\.tsx$/.test(name))
    .map((name) => ({
      file: name,
      source: readFileSync(join(SHEETS_IN, name), 'utf8')
    }))
    .filter(({ source }) => source.includes('<Sheet'));

/** Whether it leaves what is behind it reachable and undimmed. */
const isUndimmed = (source: string): boolean =>
  source.includes('isDimmed={false}');

/** How many heights it offers, read off the detents it declares. */
const heightsOffered = (source: string): number => {
  const declared = /detents=\{(\[[^\]]*\]|[A-Z_]+)\}/.exec(source);
  if (declared == null) {
    // No detents is the component default, which is a single auto height.
    return 1;
  }
  const list = declared[1];
  // A shared constant is the over-the-graph pair, which is two.
  if (!list.startsWith('[')) {
    return 2;
  }
  return list.split(',').length;
};

describe('every sheet that dims what is behind it', () => {
  it('finds the sheets it is meant to be checking', () => {
    // A test that reads a directory and finds nothing passes whether or not
    // the rule holds.
    expect(sheetSources().length).toBeGreaterThan(2);
  });

  it('INV-NOTES-214: offers exactly one height', () => {
    const wrong = sheetSources()
      .filter(({ source }) => !isUndimmed(source))
      .filter(({ source }) => heightsOffered(source) > 1)
      .map(({ file }) => file);

    expect(wrong).toEqual([]);
  });

  it('leaves a sheet that offers several heights undimmed', () => {
    const several = sheetSources().filter(
      ({ source }) => heightsOffered(source) > 1
    );
    for (const { file, source } of several) {
      expect([file, isUndimmed(source)]).toEqual([file, true]);
    }
  });
});
