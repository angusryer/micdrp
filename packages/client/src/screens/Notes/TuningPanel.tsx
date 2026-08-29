/**
 * Every threshold the reading turns on, beside the take it is reading
 * (INV-NOTES-172).
 *
 * Tuning a detector is a loop: change a number, listen, change it again. The
 * numbers lived on the account screen and the take lived three navigations
 * away, so each turn cost more than the judgement it was serving — and a loop
 * that expensive does not get run enough times to converge.
 *
 * Grouped in the order somebody meets them: what happens before anything is
 * read, what makes one note, what joins two, what is too small to have been
 * meant, and what is a struck sound rather than a sung one.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { KNOB_GROUPS, READING_KNOBS } from '../../analysis/readingKnobs';
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
      {KNOB_GROUPS.map(({ group, title }) => (
        <View key={group} style={styles.group}>
          <Text style={[styles.groupTitle, { color: colors.gray300 }]}>
            {title}
          </Text>
          {READING_KNOBS.filter((knob) => knob.group === group).map((knob) => (
            <KnobRow
              key={`${group}.${knob.key}`}
              knob={knob}
              value={knobValue(knob)}
              isOpen={open === knob.key}
              onExplain={() => setOpen(open === knob.key ? null : knob.key)}
              onStep={(by) => {
                setKnobValue(knob, knobValue(knob) + knob.step * by);
                setTurned((n) => n + 1);
              }}
            />
          ))}
        </View>
      ))}

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
