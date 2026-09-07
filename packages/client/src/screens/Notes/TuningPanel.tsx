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
import { knobScope } from '../../analysis/knobScope';
import { KnobRow } from './KnobRow';
import { coarseStep, fineStep, steppedTo } from '../../analysis/knobSteps';

export interface TuningPanelProps {
  /** Read the take again with whatever is set now. */
  onReread: () => void;
  isReading?: boolean;
  /**
   * Said where the last reading could not happen (INV-NOTES-184).
   *
   * A failure used to be indistinguishable from a reading that changed
   * nothing — the control said it was working, stopped, and the graph stayed
   * as it was. Somebody tuning presses, sees nothing, and concludes the knob
   * does nothing, which is the wrong conclusion about the wrong thing.
   */
  problem?: string | null;
  /**
   * The take being tuned, where one is (INV-NOTES-217).
   *
   * Turning a knob here changes that take's settings and leaves both the
   * app-wide numbers and every other take alone. Absent — on the account
   * screen — it changes where a new take starts.
   */
  noteId?: string | null;
}

export function TuningPanel({
  onReread,
  isReading = false,
  problem = null,
  noteId = null
}: TuningPanelProps): React.JSX.Element {
  const { colors } = useTheme();
  const scope = knobScope(noteId);
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
            scope.reset();
            setTurned((n) => n + 1);
          }}
          style={[styles.reset, { color: colors.gray300 }]}
        >
          {scope.resetSays}
        </Text>
      </View>
      {/* What a turn of one of these reaches. A person tuning has to know
          whether they are changing this take or every take to come. */}
      <Text testID="tuning-scope" style={[styles.scope, { color: colors.gray300 }]}>
        {scope.says}
      </Text>
      {/* Beside the control it belongs to, not in a banner somewhere else:
          the reading was asked for here. */}
      {problem != null ? (
        <Text testID="tuning-problem" style={[styles.problem, { color: colors.gold }]}>
          {problem}
        </Text>
      ) : null}
      {READING_KNOBS.map((knob) => (
        <KnobRow
          key={`${knob.group}.${knob.key}`}
          knob={knob}
          value={scope.value(knob)}
          isOpen={open === knob.key}
          onExplain={() => setOpen(open === knob.key ? null : knob.key)}
          onStep={(by, size) => {
            const amount = size === 'coarse' ? coarseStep(knob) : fineStep(knob);
            scope.set(knob, steppedTo(knob, scope.value(knob), amount * by));
            setTurned((n) => n + 1);
          }}
          onReset={() => {
            scope.set(knob, knob.fallback);
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
  problem: { fontSize: 12 },
  scope: { fontSize: 12, lineHeight: 16 },
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
