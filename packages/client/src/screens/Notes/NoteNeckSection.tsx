/**
 * NoteNeckSection — the melody under a hand, on a guitar neck.
 *
 * The graph says what was sung; this says where to put your fingers to sing
 * it back with an instrument. It draws the reading the graph draws
 * (INV-NOTES-150), lit one place at a time off the same shared value the
 * playhead moves on, so the two can never disagree about where the take is
 * (INV-NOTES-149).
 *
 * Every place the line visits is drawn faintly and the one sounding is drawn
 * solid, so the phrase has a shape under the hand even at rest. Under the
 * board, the marked frets are numbered (INV-NOTES-153).
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { type SharedValue } from 'react-native-reanimated';

import { NECK_FRETS, STANDARD_NECK } from 'logic';

import { NeckBoard } from './NeckBoard';
import { NeckFretNumbers } from './NeckFretNumbers';
import { TogglePill } from './TogglePill';
import { NECK_HEIGHT, layoutNeck } from './neckLayout';
import { placeMelody, visitedPlaces, type PlaceableNote } from './neckPlaces';
import { useLitPlace } from './useLitPlace';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

/** The lit dot, and the fainter ones the line also visits. */
const LIT_RADIUS = 7;
const VISITED_RADIUS = 5;
const VISITED_OPACITY = 0.28;

export interface NoteNeckSectionProps {
  /** The reading the graph is drawing, not the stored melody (INV-NOTES-150). */
  melody: readonly PlaceableNote[];
  width: number;
  isShown: boolean;
  onShown: (shown: boolean) => void;
  /** The same moment the playhead is drawn from (INV-NOTES-149). */
  positionMs?: SharedValue<number> | null;
}

export function NoteNeckSection({
  melody,
  width,
  isShown,
  onShown,
  positionMs
}: NoteNeckSectionProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const geometry = useMemo(
    () =>
      layoutNeck({
        width,
        height: NECK_HEIGHT,
        strings: STANDARD_NECK.tuning.length,
        frets: NECK_FRETS
      }),
    [width]
  );
  const placed = useMemo(
    () => placeMelody(melody, geometry),
    [melody, geometry]
  );
  const visited = useMemo(() => visitedPlaces(placed.notes), [placed]);
  const lit = useLitPlace(placed.notes, positionMs);

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <TogglePill
          testID="neck-toggle"
          label={t('notes.neckShow')}
          isOn={isShown}
          onPress={() => onShown(!isShown)}
        />
        {/* Said rather than drawn: the line is on the neck an octave from
            where it was sung, and the neck cannot show that by itself. */}
        {isShown && placed.octaves !== 0 ? (
          <Text style={[styles.caption, { color: colors.gray300 }]}>
            {t('notes.neckOctave', {
              count: Math.abs(placed.octaves),
              direction: t(
                placed.octaves > 0
                  ? 'notes.neckOctaveUp'
                  : 'notes.neckOctaveDown'
              )
            })}
          </Text>
        ) : null}
      </View>

      {isShown ? (
        <>
          <Canvas style={{ width, height: NECK_HEIGHT }}>
            <NeckBoard
              geometry={geometry}
              width={width}
              height={NECK_HEIGHT}
              colors={{
                board: colors.gold,
                wire: colors.neutral50,
                string: colors.neutral100,
                marker: colors.neutral300
              }}
            />
            {visited.map((at) => (
              <Circle
                key={at.key}
                cx={at.x}
                cy={at.y}
                r={VISITED_RADIUS}
                color={colors.white}
                opacity={VISITED_OPACITY}
              />
            ))}
            <Circle
              cx={lit.x}
              cy={lit.y}
              r={LIT_RADIUS}
              color={colors.primary500}
            />
          </Canvas>
          {/* Off the board rather than on it, so no number lands on a string
              or a wire (INV-NOTES-153). */}
          <NeckFretNumbers
            geometry={geometry}
            width={width}
            color={colors.gray300}
          />
        </>
      ) : null}
    </View>
  );
}

export default NoteNeckSection;

const styles = StyleSheet.create({
  block: { gap: 6, marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caption: { fontSize: 12, flexShrink: 1 }
});
