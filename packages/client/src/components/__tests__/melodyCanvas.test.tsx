/**
 * What the melody graph actually draws — INV-NOTES-102 and INV-NOTES-107 at
 * the level where they are really true.
 *
 * The unit tests beside this one pin the arithmetic. This pins that the
 * arithmetic reaches the canvas: that the rules come out dashed and in the
 * right order of weight, and that the pickup is shaded under everything else.
 * Neither could be checked before, because a Skia canvas leaves nothing in
 * the tree to query — which is exactly the pressure that gets runtime code
 * reshaped for the convenience of tests.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { I18nProvider } from '../../i18n';
import { ThemeProvider } from '../../theme';
import { skiaDrawn, pathCommands } from '../../testing/skiaDrawn';
import { BAR_RULE, BEAT_RULE } from '../metreLines';
import { MelodyView } from '../MelodyView';
import type { MelodyNote } from '../melodyLayout';

const NOTES: MelodyNote[] = [
  { midi: 60, startMs: 2000, endMs: 2500 },
  { midi: 64, startMs: 2500, endMs: 3000 },
  { midi: 67, startMs: 3000, endMs: 4000 }
] as MelodyNote[];

const GRID = { bpm: 120, offsetMs: 2000, beatsPerBar: 4, stepsPerBeat: 4 };

/** From the start of the recording, so there is two seconds of pickup. */
const draw = (fromMs?: number) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <MelodyView
          notes={NOTES}
          width={600}
          height={200}
          grid={GRID}
          beatWidth={60}
          fromMs={fromMs}
        />
      </ThemeProvider>
    </I18nProvider>
  );

type Drawing = Awaited<ReturnType<typeof draw>>;

/** The metre's own rules — not the line marking where the singing starts. */
const rulesOf = (tree: Drawing) =>
  skiaDrawn(tree, 'Line').filter((line) =>
    [BAR_RULE.opacity, BEAT_RULE.opacity].includes(line.props.opacity as number)
  );

describe('the melody graph, as drawn', () => {
  it('dashes every rule it puts down', async () => {
    const tree = await draw(0);
    const rules = rulesOf(tree);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(skiaDrawn(rule, 'DashPathEffect')).toHaveLength(1);
    }
  });

  it('leaves the line marking the start of the singing solid', async () => {
    // It is a boundary in the recording rather than a beat in the music
    // (INV-NOTES-080), so it is not one of the rules and is not dashed.
    const tree = await draw(0);
    const solid = skiaDrawn(tree, 'Line').filter(
      (line) => skiaDrawn(line, 'DashPathEffect').length === 0
    );
    expect(solid).toHaveLength(1);
  });

  it('draws the downbeats over the pulse between them', async () => {
    const tree = await draw(0);
    const strengths = new Set(
      rulesOf(tree).map((line) => line.props.opacity as number)
    );
    // Both kinds present, and the ordering is the one the tokens declare.
    expect(strengths.has(BAR_RULE.opacity)).toBe(true);
    expect(strengths.has(BEAT_RULE.opacity)).toBe(true);
    expect(BAR_RULE.opacity).toBeGreaterThan(BEAT_RULE.opacity);
  });

  it('shades the pickup, and shades it first', async () => {
    const tree = await draw(0);
    const [hatch] = skiaDrawn(tree, 'Path');
    expect(hatch).toBeDefined();
    // Ground, not a mark: stroked, barely there, and written into a path
    // rather than drawn as a line each.
    expect(hatch.props.style).toBe('stroke');
    expect(hatch.props.opacity as number).toBeLessThan(0.2);
    expect(pathCommands(hatch.props.path).length).toBeGreaterThan(0);
  });

  it('shades nothing when the singing starts at the recording', async () => {
    // No pickup, so there is no region that is different in kind.
    expect(skiaDrawn(await draw(), 'Path')).toHaveLength(0);
  });
});
