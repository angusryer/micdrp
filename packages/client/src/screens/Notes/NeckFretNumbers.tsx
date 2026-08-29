/**
 * The fret numbers under the board (INV-NOTES-153).
 *
 * A dot says "this is one of the frets you count by"; it does not say which
 * one, and near the twelfth the spaces are a few pixels wide, so counting up
 * from the nut is guesswork. The numbers turn the drawing into something a
 * fret can be named on out loud.
 *
 * Real text rather than a Skia glyph: nothing in this app loads a Skia font,
 * and a strip of five numerals is not worth being the first thing to. It also
 * keeps them scaling with the reader's type size, and readable to a screen
 * reader, neither of which a painted glyph would be.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NUMBERED_FRETS, type NeckGeometry } from './neckLayout';

export interface NeckFretNumbersProps {
  geometry: NeckGeometry;
  width: number;
  color: string;
}

/** Tall enough for the numerals, short enough not to cost the graph height. */
export const FRET_NUMBER_HEIGHT = 14;

/** Each number is centred in a box this wide, so "12" is not clipped. */
const LABEL_WIDTH = 20;

const testIDFor = (fret: number) => `neck-fret-number-${fret}`;

export function NeckFretNumbers({
  geometry,
  width,
  color
}: NeckFretNumbersProps): React.JSX.Element {
  return (
    <View style={[styles.strip, { width, height: FRET_NUMBER_HEIGHT }]}>
      {NUMBERED_FRETS.map((fret) => (
        <Text
          key={fret}
          testID={testIDFor(fret)}
          // Centred on the fret space its marker is centred on, so the
          // number and the dot are read as the same thing.
          style={[
            styles.label,
            { color, left: geometry.centreOf(fret) - LABEL_WIDTH / 2 }
          ]}
        >
          {fret}
        </Text>
      ))}
    </View>
  );
}

export default NeckFretNumbers;

const styles = StyleSheet.create({
  strip: { position: 'relative' },
  label: {
    position: 'absolute',
    top: 0,
    width: LABEL_WIDTH,
    fontSize: 10,
    lineHeight: FRET_NUMBER_HEIGHT,
    textAlign: 'center'
  }
});
