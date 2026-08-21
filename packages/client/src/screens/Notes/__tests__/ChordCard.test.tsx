/**
 * ChordCard gestures — INV-NOTES-017 / INT-NOTES-005.
 *
 * The card used to lock an axis mid-drag and read horizontal movement as a
 * shape change, which meant the horizontal scroll view holding the track never
 * saw that drag: the maintainer could not scroll to a later bar, and every
 * attempt changed a chord instead. These tests pin both halves of the fix — the
 * pan is declared vertical-only so a sideways drag falls through to the track,
 * and its update path has no horizontal branch left to fire.
 *
 * `await waitFor(() => render(...))` before touching any query, matching
 * renderNoteCard.tsx — a bare render leaves `screen` unbound in this setup.
 */
import { render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId
} from 'react-native-gesture-handler/jest-utils';
import React from 'react';

import type { ChordSlot } from 'logic';

import { I18nProvider } from '../../../i18n';
import { ThemeProvider } from '../../../theme';
import { ChordCard } from '../ChordCard';

const SLOT: ChordSlot = {
  bar: 1,
  startMs: 0,
  endMs: 2000,
  rootPc: 0,
  quality: 'major',
  label: 'C',
  roman: 'I',
  isEdited: false
} as unknown as ChordSlot;

const handlers = () => ({
  onNudge: jest.fn(),
  onReshape: jest.fn(),
  onAudition: jest.fn(),
  onRevert: jest.fn()
});

const renderCard = (props: ReturnType<typeof handlers>) =>
  waitFor(() =>
    render(
      <GestureHandlerRootView>
        <I18nProvider>
          <ThemeProvider>
            <ChordCard slot={SLOT} index={0} {...props} />
          </ThemeProvider>
        </I18nProvider>
      </GestureHandlerRootView>
    )
  );

describe('ChordCard gestures', () => {
  it('gives up the drag on horizontal movement so the track can scroll', async () => {
    await renderCard(handlers());

    const pan = getByGestureTestId('chord-pan-0');
    // Both bounds, or a one-sided config would still swallow drags one way.
    expect(pan.config.failOffsetXStart).toBeLessThan(0);
    expect(pan.config.failOffsetXEnd).toBeGreaterThan(0);
    expect(pan.config.activeOffsetYStart).toBeLessThan(0);
    expect(pan.config.activeOffsetYEnd).toBeGreaterThan(0);
  });

  it('does not reshape when a drag is horizontal', async () => {
    const props = handlers();
    await renderCard(props);

    fireGestureHandler(getByGestureTestId('chord-pan-0'), [
      { translationX: 0, translationY: 0 },
      { translationX: 60, translationY: 0 },
      { translationX: 140, translationY: 0 }
    ]);

    expect(props.onReshape).not.toHaveBeenCalled();
    expect(props.onNudge).not.toHaveBeenCalled();
  });

  it('still nudges through the key on a vertical drag', async () => {
    const props = handlers();
    await renderCard(props);

    fireGestureHandler(getByGestureTestId('chord-pan-0'), [
      { translationX: 0, translationY: 0 },
      { translationX: 0, translationY: -40 }
    ]);

    // Dragging up raises the chord, so the degree delta is positive.
    expect(props.onNudge).toHaveBeenCalledWith(0, 1);
  });

  it('steps the shape on a double tap', async () => {
    const props = handlers();
    await renderCard(props);

    fireGestureHandler(getByGestureTestId('chord-double-tap-0'), [{}]);

    expect(props.onReshape).toHaveBeenCalledWith(0, 1);
    expect(props.onAudition).not.toHaveBeenCalled();
  });

  it('sounds the chord on a single tap', async () => {
    const props = handlers();
    await renderCard(props);

    fireGestureHandler(getByGestureTestId('chord-tap-0'), [{}]);

    expect(props.onAudition).toHaveBeenCalledWith(0);
    expect(props.onReshape).not.toHaveBeenCalled();
  });
});
