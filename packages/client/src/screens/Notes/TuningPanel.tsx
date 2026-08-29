/**
 * Every threshold the reading turns on, beside the take it is reading
 * (INV-NOTES-172).
 *
 * Tuning a detector is a loop: change a number, listen, change it again. The
 * numbers lived on the account screen and the take lived three navigations
 * away, so each turn cost more than the judgement it was serving — and a loop
 * that expensive does not get run enough times to converge.
 *
 * Ordered by how much moving one changes a whistled melody rather than by
 * which part of the reading it belongs to. Somebody tuning wants the knob
 * most likely to fix what they are looking at, not the one that happens to
 * live in the same argument as the last one they tried.
 *
 * The actions sit above the list: they are what the list is for, and a person
 * reads them, changes something, and comes back up to press one.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { READING_KNOBS } from '../../analysis/knobOrder';
import {
  knobValue,
  resetKnobs,
  setKnobValue
} from '../../analysis/readingValues';
import { KnobRow } from './KnobRow';

export interface TuningPanelProps {
  /** Read the take again with whatever is set now. */
  onReread: () => void;
  isReading?: boolean;
}

export function TuningPanel({
  onReread,
  isReading = false
}: TuningPanelProps): React.JSX.Element {
  const { colors } = useTheme();
  // One counter rather than a value per knob: what is stored is the truth and
  // this only says it changed, which is what a re-render needs to know.
  const [turned, setTurned] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={styles.wrap} key={turned}>
      <View style={styles.actions}>
        <Text
          accessibilityRole="button"
          testID="tuning-reread"
          onPress={onReread}
          style={[
            styles.read,
            { color: colors.primary500, backgroundColor: colors.neutral100 }
          ]}
        >
          {isReading ? 'Reading…' : 'Read it again'}
        </Text>
        <Text
          accessibilityRole="button"
          testID="tuning-reset"
          onPress={() => {
            resetKnobs();
            setTurned((n) => n + 1);
          }}
          style={[styles.reset, { color: colors.gray300 }]}
        >
          Back to defaults
        </Text>
      </View>
      {READING_KNOBS.map((knob) => (
        <KnobRow
          key={`${knob.group}.${knob.key}`}
          knob={knob}
          value={knobValue(knob)}
          isOpen={open === knob.key}
          onExplain={() => setOpen(open === knob.key ? null : knob.key)}
          onStep={(by) => {
            setKnobValue(knob, knobValue(knob) + knob.step * by);
            setTurned((n) => n + 1);
          }}
          onReset={() => {
            setKnobValue(knob, knob.fallback);
            setTurned((n) => n + 1);
          }}
        />
      ))}
    </View>
  );
}

export default TuningPanel;

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  group: { gap: 2 },
  groupTitle: { fontSize: 12, fontWeight: '600', paddingBottom: 2 },
  // Fixed width so a column of numbers does not jitter as they change.
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  read: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden'
  },
  reset: { fontSize: 13 }
});
