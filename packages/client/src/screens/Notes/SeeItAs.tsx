/**
 * See a take as it was sung, or as it was written down (INV-NOTES-026).
 *
 * The sibling of HearItAs, for the eye. As sung, every note sits where it was
 * sung and carries its cents; as written, every onset sits on the grid at a
 * notated length. A snap onto the wrong step is plain in the picture and all
 * but inaudible in a short take, so this is how the quantizer gets judged.
 *
 * Its own control rather than a second use of the playback one: reading the
 * notation while listening to the raw take is how a person tells which of the
 * two is wrong, and one toggle driving both would take that away.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { NotationView } from 'logic';

import { useTheme } from '../../theme';
import { ModeChoice, type ModeOption } from './ModeChoice';

export interface SeeItAsProps {
  view: NotationView;
  onChange: (view: NotationView) => void;
  /** False when there is no grid, so notation has nothing to draw against. */
  canNotate: boolean;
}

const VIEWS: { view: NotationView; label: string; hint: string }[] = [
  { view: 'as-sung', label: 'As sung', hint: 'drawn where each note was sung' },
  {
    view: 'as-notated',
    label: 'As written',
    hint: 'drawn on the grid, at notated lengths'
  }
];

export function SeeItAs({
  view,
  onChange,
  canNotate
}: SeeItAsProps): React.JSX.Element {
  const { colors } = useTheme();
  const active = VIEWS.find((v) => v.view === view) ?? VIEWS[0];
  const options: ModeOption<NotationView>[] = VIEWS.map((v) => ({
    value: v.view,
    label: v.label,
    // Notation needs a grid. Offering it when there is none would promise
    // something the take cannot answer.
    disabled: v.view === 'as-notated' && !canNotate
  }));

  return (
    <View style={styles.wrap}>
      <ModeChoice
        options={options}
        value={view}
        onChange={onChange}
        testIDPrefix="see"
      />
      <Text style={[styles.hint, { color: colors.gray500 }]}>{active.hint}</Text>
    </View>
  );
}

export default SeeItAs;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  hint: { fontSize: 12, textAlign: 'center' }
});
