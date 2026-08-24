/**
 * INV-NOTES-117 — the struck sounds, as drawn.
 *
 * The geometry is pinned next door. What this pins is that it reaches the
 * canvas: that a band appears only where something was struck, that it takes
 * room only for the lanes in use, and that it draws every hit rather than the
 * ones whose kind happens to be known.
 *
 * Read back through the Skia recorder, so the drawing code stays written for
 * drawing rather than for being inspected.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { I18nProvider } from '../../i18n';
import { ThemeProvider } from '../../theme';
import { skiaDrawn } from '../../testing/skiaDrawn';
import { RhythmBand, rhythmBandHeight, LANE_HEIGHT } from '../RhythmBand';
import type { TimeAxis } from '../melodyScale';
import type { Hit, HitKind } from 'logic';

const AXIS: TimeAxis = { t0: 0, span: 4000, pad: 10, innerW: 400, pxPerMs: 0.1 };

const hit = (atMs: number, kind: HitKind, loudnessDb = -12): Hit => ({
  atMs,
  durationMs: 40,
  loudnessDb,
  centroidHz: 1000,
  flatness: 0.7,
  kind,
  confidence: 0.8
});

const draw = (hits: Hit[]) =>
  render(
    <I18nProvider>
      <ThemeProvider>
        <RhythmBand
          hits={hits}
          timeAxis={AXIS}
          contentWidth={420}
          height={rhythmBandHeight(hits)}
        />
      </ThemeProvider>
    </I18nProvider>
  );

describe('the rhythm band', () => {
  it('draws a head for every hit', async () => {
    const tree = await draw([
      hit(0, 'thump'),
      hit(400, 'tap'),
      hit(800, 'hiss')
    ]);
    expect(skiaDrawn(tree, 'Circle')).toHaveLength(3);
  });

  it('draws a hit whose kind was never worked out', async () => {
    // An older engine reports no spectrum. The sound was still made, and
    // dropping it would hide part of the take.
    const tree = await draw([hit(0, 'unknown')]);
    expect(skiaDrawn(tree, 'Circle')).toHaveLength(1);
  });

  it('takes no room at all when nothing was struck', async () => {
    expect(rhythmBandHeight([])).toBe(0);
    const tree = await draw([]);
    expect(skiaDrawn(tree, 'Circle')).toHaveLength(0);
  });

  it('takes room only for the lanes in use', async () => {
    // A take of nothing but thumps gets one lane, not four.
    expect(rhythmBandHeight([hit(0, 'thump'), hit(400, 'thump')])).toBe(
      LANE_HEIGHT
    );
    expect(rhythmBandHeight([hit(0, 'thump'), hit(400, 'hiss')])).toBe(
      LANE_HEIGHT * 2
    );
  });

  it('draws a harder hit larger than a softer one', async () => {
    const tree = await draw([hit(0, 'tap', -4), hit(400, 'tap', -50)]);
    const [hard, soft] = skiaDrawn(tree, 'Circle');
    expect(hard.props.r as number).toBeGreaterThan(soft.props.r as number);
  });

  it('takes no touches, since one surface reads them all', async () => {
    const tree = await draw([hit(0, 'thump')]);
    expect(tree.getByTestId('rhythm-band').props.pointerEvents).toBe('none');
  });
});
