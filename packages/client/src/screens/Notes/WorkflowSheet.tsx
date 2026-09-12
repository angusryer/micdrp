/**
 * Where the take's next step is kept, and the mark that fetches it
 * (INV-NOTES-270).
 *
 * A strip that is always there costs the height of a strip on every take
 * forever — including every take whose steps are long done, and every
 * visit that came to do something else. Guidance is wanted on the way in
 * and in the way after that, so it is put away by default and fetched
 * from one fixed place: beside the name of the thing it is about, which
 * is where a person looks to ask what this is.
 *
 * The mark is gone once the take has everything, for the same reason the
 * guide itself is (INV-NOTES-267): there is nothing left to ask.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { WorkflowStep } from 'logic';

import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useTheme } from '../../theme';
import { WorkflowGuide, type WorkflowGuideProps } from './WorkflowGuide';

export interface WorkflowTabProps {
  step: WorkflowStep;
  onOpen: () => void;
}

/** The mark at the right-hand end of the take's title row. */
export function WorkflowTab({
  step,
  onOpen
}: WorkflowTabProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (step === 'done') {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="What to do next with this take"
      testID="workflow-tab"
      hitSlop={12}
      onPress={onOpen}
      style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Icon name="help" size={22} color={colors.primary500} />
    </Pressable>
  );
}

export interface WorkflowSheetProps extends WorkflowGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onCover?: (name: string, px: number) => void;
}

export function WorkflowSheet({
  isOpen,
  onClose,
  onCover,
  ...guide
}: WorkflowSheetProps): React.JSX.Element {
  return (
    <Sheet name="workflow" isOpen={isOpen} onClose={onClose} onCover={onCover}>
      <WorkflowGuide {...guide} />
    </Sheet>
  );
}

export default WorkflowSheet;

const styles = StyleSheet.create({
  // On the title's own row, at its right-hand end.
  tab: { paddingLeft: 12, paddingVertical: 2 }
});
