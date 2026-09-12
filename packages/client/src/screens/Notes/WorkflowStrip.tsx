/**
 * The take's next step, and the control for it (INV-NOTES-267).
 *
 * Every step of the workflow existed as a control somewhere on the note,
 * discoverable only by someone who already knew the order. This names
 * where the take is — count in, bassline, chords — and puts that step's
 * own control here, so the take leads and the person follows. A step the
 * take already has is skipped rather than shown; with everything present
 * there is nothing to show at all.
 *
 * Correcting notes and beats is not a step. Nothing in the data can say
 * corrections are finished, so it is a standing offer beside every step
 * from the count-in on, and gates none of them.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LED_STEPS, stepNumber, type WorkflowStep } from 'logic';

import { useTheme } from '../../theme';
import { PickupMaker, type PickupMakerProps } from './PickupMaker';

export interface WorkflowStripProps {
  step: WorkflowStep;
  /** The count-in step's own control, when that is the step. */
  countIn: Omit<PickupMakerProps, 'onCancel'>;
  /** Whether a bass layer is being recorded right now. */
  isRecording: boolean;
  /** Start recording the bassline, hearing the count-in first; or stop. */
  onRecord: () => void;
  /** Ask for the chords. */
  onChords: () => void;
}

const TITLES: Record<Exclude<WorkflowStep, 'done'>, string> = {
  'count-in': 'Count it in',
  bassline: 'Sing a bassline',
  chords: 'Read the chords'
};

const HINTS: Record<Exclude<WorkflowStep, 'done'>, string> = {
  'count-in':
    'Play the take and tap the count you would give somebody before they came in.',
  bassline:
    'You will hear the count-in, then the take. Sing the bass under it — it names the chords a melody only implies.',
  chords: 'Read the chords from the take and the bassline. You can change any of them after.'
};

export function WorkflowStrip({
  step,
  countIn,
  isRecording,
  onRecord,
  onChords
}: WorkflowStripProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (step === 'done') {
    return null;
  }

  return (
    <View
      testID="workflow-strip"
      style={[
        styles.strip,
        { backgroundColor: colors.neutral100, borderColor: colors.neutral500 }
      ]}
    >
      <Text style={[styles.where, { color: colors.gray300 }]}>
        Step {stepNumber(step)} of {LED_STEPS}
      </Text>
      <Text style={[styles.title, { color: colors.typography }]}>{TITLES[step]}</Text>
      <Text style={[styles.hint, { color: colors.gray300 }]}>{HINTS[step]}</Text>

      {step === 'count-in' ? (
        <PickupMaker {...countIn} onCancel={() => undefined} />
      ) : step === 'bassline' ? (
        <Text
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording the bassline' : 'Record a bassline'}
          testID="workflow-record-bass"
          onPress={onRecord}
          style={[styles.action, { color: isRecording ? colors.error : colors.primary500 }]}
        >
          {isRecording ? 'Stop' : 'Record a bassline'}
        </Text>
      ) : (
        <Text
          accessibilityRole="button"
          accessibilityLabel="Read the chords"
          testID="workflow-read-chords"
          onPress={onChords}
          style={[styles.action, { color: colors.primary500 }]}
        >
          Read the chords
        </Text>
      )}

      <Text style={[styles.aside, { color: colors.gray300 }]}>
        Fix any notes or beats as you go — move, stretch, add or delete them on the graph.
      </Text>
    </View>
  );
}

export default WorkflowStrip;

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    gap: 6
  },
  where: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18 },
  action: { fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  aside: { fontSize: 12, lineHeight: 16, marginTop: 4 }
});
